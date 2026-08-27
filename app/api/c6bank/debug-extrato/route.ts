/**
 * Rota de diagnóstico: testa variações do endpoint de extrato.
 * Remove após resolver o RF-InvalidRequest.
 */
import { NextResponse } from "next/server";
import { C6_BASE, getToken } from "@/lib/c6bank";
import https from "node:https";
import { URL } from "node:url";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function httpsRequest(
  urlStr: string,
  opts: { method: string; headers: Record<string, string>; cert: string; key: string }
): Promise<{ status: number; body: string; headers: Record<string, string | string[] | undefined> }> {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const req = https.request(
      {
        hostname: u.hostname,
        port: 443,
        path: u.pathname + u.search,
        method: opts.method,
        headers: opts.headers,
        cert: opts.cert,
        key: opts.key,
      },
      (res) => {
        let raw = "";
        res.on("data", (c: string) => (raw += c));
        res.on("end", () =>
          resolve({ status: res.statusCode ?? 0, body: raw, headers: res.headers as Record<string, string | string[] | undefined> })
        );
      }
    );
    req.on("error", reject);
    req.end();
  });
}

export async function GET() {
  const certB64 = process.env.C6_CERT_PEM_B64 ?? "";
  const keyB64 = process.env.C6_KEY_PEM_B64 ?? "";
  const cert = Buffer.from(certB64, "base64").toString("utf-8");
  const key = Buffer.from(keyB64, "base64").toString("utf-8");
  const clientId = process.env.C6_CLIENT_ID ?? "";

  let token: string;
  try {
    token = await getToken();
  } catch (e) {
    return NextResponse.json({ error: "Auth falhou: " + String(e) }, { status: 500 });
  }

  // CONFIRMADO: path correto é /v1/statement, params são start_date/end_date (snake_case).
  // Teste sem params retornou 400 formatado (chegou no backend).
  // Teste COM params (range de 31 dias) retornou 500 RF-InvalidRequest (fault no Apigee,
  // antes do backend) → suspeita: limite de dias no gateway é mais restrito que o esperado.
  // Testamos aqui vários tamanhos de intervalo para isolar o limite.
  const variants: Array<{ label: string; url: string; headers: Record<string, string> }> = [
    {
      label: "A. range de 1 dia (2025-10-10 a 2025-10-11)",
      url: `${C6_BASE}/v1/statement?start_date=2025-10-10&end_date=2025-10-11`,
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    },
    {
      label: "B. range de 7 dias (2025-10-10 a 2025-10-17)",
      url: `${C6_BASE}/v1/statement?start_date=2025-10-10&end_date=2025-10-17`,
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    },
    {
      label: "C. range de 30 dias (2025-10-10 a 2025-11-09)",
      url: `${C6_BASE}/v1/statement?start_date=2025-10-10&end_date=2025-11-09`,
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    },
    {
      label: "D. range de 31 dias (2025-10-10 a 2025-11-10) ← igual ao original",
      url: `${C6_BASE}/v1/statement?start_date=2025-10-10&end_date=2025-11-10`,
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    },
    {
      label: "E. mesma data (2025-10-10 a 2025-10-10)",
      url: `${C6_BASE}/v1/statement?start_date=2025-10-10&end_date=2025-10-10`,
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    },
    {
      label: "F. datas de hoje (data atual, range de 7 dias)",
      url: `${C6_BASE}/v1/statement?start_date=2026-08-20&end_date=2026-08-27`,
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    },
    {
      label: "G. só start_date (sem end_date)",
      url: `${C6_BASE}/v1/statement?start_date=2025-10-10`,
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    },
    {
      label: "H. ordem invertida end_date antes de start_date",
      url: `${C6_BASE}/v1/statement?end_date=2025-10-17&start_date=2025-10-10`,
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    },
  ];

  const results = [];
  for (const v of variants) {
    try {
      const t0 = Date.now();
      const res = await httpsRequest(v.url, { method: "GET", headers: v.headers, cert, key });
      let parsed: unknown;
      try { parsed = JSON.parse(res.body); } catch { parsed = res.body; }
      results.push({
        label: v.label,
        status: res.status,
        elapsed: Date.now() - t0,
        body: parsed,
        responseHeaders: {
          "content-type": res.headers["content-type"],
          "x-apigee-fault-code": res.headers["x-apigee-fault-code"],
          "x-apigee-fault-flag": res.headers["x-apigee-fault-flag"],
          "www-authenticate": res.headers["www-authenticate"],
        },
      });
    } catch (e) {
      results.push({ label: v.label, error: String(e) });
    }
  }

  return NextResponse.json({ token_prefix: token.slice(0, 20) + "...", results });
}
