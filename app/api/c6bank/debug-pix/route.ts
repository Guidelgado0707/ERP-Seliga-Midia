/**
 * Rota de diagnóstico: testa variações do endpoint de criação de PIX.
 * Remove após resolver.
 */
import { NextResponse } from "next/server";
import { C6_BASE, getToken } from "@/lib/c6bank";
import https from "node:https";
import { URL } from "node:url";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function httpsRequest(
  urlStr: string,
  opts: { method: string; headers: Record<string, string>; cert: string; key: string },
  body?: string
): Promise<{ status: number; body: string }> {
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
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: raw }));
      }
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

export async function POST() {
  const certB64 = process.env.C6_CERT_PEM_B64 ?? "";
  const keyB64 = process.env.C6_KEY_PEM_B64 ?? "";
  const cert = Buffer.from(certB64, "base64").toString("utf-8");
  const key = Buffer.from(keyB64, "base64").toString("utf-8");
  const chave = process.env.C6_PIX_KEY ?? "";

  let token: string;
  try {
    token = await getToken();
  } catch (e) {
    return NextResponse.json({ error: "Auth falhou: " + String(e) }, { status: 500 });
  }

  const payload = JSON.stringify({
    calendario: { expiracao: 3600 },
    valor: { original: "10.00" },
    chave,
    devedor: { cpf: "11144477735", nome: "Cliente Teste ERP" },
  });

  const paths = [
    "/v1/pix/cob",
    "/v1/pix/cob/",
    "/pix/cob",
    "/pix/cob/",
    "/v1/pix/cobrancas",
    "/v1/pix",
  ];

  const results = [];
  for (const p of paths) {
    try {
      const res = await httpsRequest(
        `${C6_BASE}${p}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload).toString(),
            Accept: "application/json",
          },
          cert,
          key,
        },
        payload
      );
      let parsed: unknown;
      try { parsed = JSON.parse(res.body); } catch { parsed = res.body; }
      results.push({ path: p, status: res.status, body: parsed });
    } catch (e) {
      results.push({ path: p, error: String(e) });
    }
  }

  return NextResponse.json({ results });
}
