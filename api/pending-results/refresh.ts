import type { IncomingMessage, ServerResponse } from "node:http";

const FOOTBALL_API_URL =
  "https://api.football-data.org/v4/competitions/WC/matches";

export default async function handler(
  _req: IncomingMessage,
  res: ServerResponse
) {
  if (_req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json", Allow: "POST" });
    res.end(JSON.stringify({ error: "Método não permitido" }));
    return;
  }
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "FOOTBALL_DATA_API_KEY não configurada." }));
    return;
  }
  try {
    const upstream = await fetch(FOOTBALL_API_URL, {
      headers: { "X-Auth-Token": apiKey },
    });
    if (!upstream.ok) throw new Error(`HTTP ${upstream.status}`);
    const data = (await upstream.json()) as { matches?: unknown[] };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        matches: data.matches ?? [],
        lastCheckedAt: new Date().toISOString(),
      })
    );
  } catch {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Falha ao consultar football-data.org" }));
  }
}
