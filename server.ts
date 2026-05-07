import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 4000;

  app.use(express.json());

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
