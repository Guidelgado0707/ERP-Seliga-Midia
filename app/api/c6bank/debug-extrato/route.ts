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

  const START = "2025-10-10";
  const END = "2025-11-10";

  // Variações a testar
  const variants: Array<{ label: string; url: string; headers: Record<string, string> }> = [
    {
      label: "1. /v1/statement (sem trailing slash, snake_case)",
      url: `${C6_BASE}/v1/statement?start_date=${START}&end_date=${END}`,
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    },
    {
      label: "2. /v1/statement/ (com trailing slash, snake_case)",
      url: `${C6_BASE}/v1/statement/?start_date=${START}&end_date=${END}`,
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    },
    {
      label: "3. /v1/statement (camelCase params)",
      url: `${C6_BASE}/v1/statement?startDate=${START}&endDate=${END}`,
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    },
    {
      label: "4. /v1/statement (start/end params)",
      url: `${C6_BASE}/v1/statement?start=${START}&end=${END}`,
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    },
    {
      label: "5. /v1/statement com client_id no header",
      url: `${C6_BASE}/v1/statement?start_date=${START}&end_date=${END}`,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "client_id": clientId,
        "x-client-id": clientId,
      },
    },
    {
      label: "6. /v1/baas/statement (path alternativo)",
      url: `${C6_BASE}/v1/baas/statement?start_date=${START}&end_date=${END}`,
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    },
    {
      label: "7. Sem parâmetros (ver erro de validação)",
      url: `${C6_BASE}/v1/statement`,
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
