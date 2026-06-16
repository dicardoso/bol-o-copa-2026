import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Football Data API cache (populated by background cron) ---
let cachedApiMatches: Record<string, unknown>[] = [];
let lastCheckedAt: string | null = null;

const FOOTBALL_API_URL = "https://api.football-data.org/v4/competitions/WC/matches";
const CRON_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

let pollInProgress = false;

async function pollFootballApi() {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    console.warn("[ResultsCron] FOOTBALL_DATA_API_KEY não definida — polling desativado.");
    return;
  }
  if (pollInProgress) return;
  pollInProgress = true;
  try {
    const response = await fetch(FOOTBALL_API_URL, {
      headers: { "X-Auth-Token": apiKey },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    const data = (await response.json()) as { matches?: Record<string, unknown>[] };
    cachedApiMatches = data.matches ?? [];
    lastCheckedAt = new Date().toISOString();
    const finished = cachedApiMatches.filter((m) => m["status"] === "FINISHED").length;
    console.log(`[ResultsCron] ${cachedApiMatches.length} jogos, ${finished} encerrados`);
  } catch (err) {
    console.error("[ResultsCron] Erro ao consultar API:", err);
  } finally {
    pollInProgress = false;
  }
}

// Roda imediatamente e a cada 5 minutos
pollFootballApi();
setInterval(pollFootballApi, CRON_INTERVAL_MS);

async function startServer() {
  const app = express();
  const PORT = 8000;

  app.use(express.json());

  // Proxy para football-data.org (leitura on-demand, usada pelo syncWorldCupMatches)
  app.get("/api/football-proxy", async (req, res) => {
    const apiKey = process.env.FOOTBALL_DATA_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "FOOTBALL_DATA_API_KEY não configurada." });
    }
    try {
      const response = await fetch(FOOTBALL_API_URL, {
        headers: { "X-Auth-Token": apiKey },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      res.json(data);
    } catch (err) {
      console.error("[football-proxy]", err);
      res.status(502).json({ error: "Falha ao consultar football-data.org" });
    }
  });

  // Retorna o cache mais recente do cron (sem nova requisição à API)
  app.get("/api/pending-results", (req, res) => {
    res.json({ matches: cachedApiMatches, lastCheckedAt });
  });

  // Força uma nova consulta à API e retorna o resultado imediatamente
  app.post("/api/pending-results/refresh", async (req, res) => {
    await pollFootballApi();
    res.json({ matches: cachedApiMatches, lastCheckedAt });
  });

  // Rota de API para envio de e-mail via SMTP
  app.post("/api/send-email", async (req, res) => {
    const { to, subject, html } = req.body;

    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || "587");
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || "noreply@nose.com";

    console.log(`Tentando enviar e-mail para ${to} usando o host: ${host}`);

    if (!host || !user || !pass) {
      console.error("Configurações SMTP ausentes no ambiente.");
      return res.status(500).json({ error: "Configuração de e-mail pendente no servidor." });
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    try {
      await transporter.sendMail({
        from,
        to,
        subject,
        html,
      });
      res.json({ success: true, message: "E-mail enviado com sucesso." });
    } catch (error) {
      console.error("Erro ao enviar e-mail via SMTP:", error);
      res.status(502).json({ error: "Falha na comunicação com o servidor SMTP." });
    }
  });

  // Configuração do Vite Middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
