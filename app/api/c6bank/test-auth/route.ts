/**
 * Rota de diagnóstico: testa apenas a autenticação C6 (mTLS + OAuth2).
 * Útil para isolar se o problema é no auth ou no extrato.
 */
import { NextRequest, NextResponse } from "next/server";
import { C6_BASE } from "@/lib/c6bank";
import { tokenValido } from "@/lib/bancoPin";
import https from "node:https";
import { URL } from "node:url";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function httpsRequest(
  urlStr: string,
  opts: { method: string; headers: Record<string, string>; cert: string; key: string },
  body?: string
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const req = https.request(
      { hostname: u.hostname, port: 443, path: u.pathname + u.search,
        method: opts.method, headers: opts.headers, cert: opts.cert, key: opts.key },
      (res) => {
        let raw = "";
        res.on("data", (c: string) => (raw += c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: raw }));
      }
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

export async function GET(request: NextRequest) {
  if (!tokenValido(request.headers.get("x-banco-pin-token"))) {
    return NextResponse.json({ error: "PIN não verificado ou expirado" }, { status: 401 });
  }

  const t0 = Date.now();
  const certB64 = process.env.C6_CERT_PEM_B64 ?? "";
  const keyB64 = process.env.C6_KEY_PEM_B64 ?? "";
  const cert = Buffer.from(certB64, "base64").toString("utf-8");
  const key = Buffer.from(keyB64, "base64").toString("utf-8");
  const clientId = process.env.C6_CLIENT_ID ?? "";
  const clientSecret = process.env.C6_CLIENT_SECRET ?? "";

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  }).toString();

  try {
    const res = await httpsRequest(
      `${C6_BASE}/v1/auth/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body).toString(),
          Accept: "application/json",
        },
        cert, key,
      },
      body
    );

    let parsed: unknown;
    try { parsed = JSON.parse(res.body); } catch { parsed = res.body; }

    return NextResponse.json({
      ok: res.status >= 200 && res.status < 300,
      httpStatus: res.status,
      rawResponse: parsed,
      elapsedMs: Date.now() - t0,
      env: C6_BASE,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg, elapsedMs: Date.now() - t0 }, { status: 500 });
  }
}
