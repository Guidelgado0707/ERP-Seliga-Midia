/**
 * C6 Bank BaaS client — autenticação OAuth2 + mTLS, extrato.
 * Roda apenas no servidor (Node.js). Não importar em componentes client.
 */
import https from "node:https";
import { URL } from "node:url";

const IS_SANDBOX = process.env.C6_SANDBOX !== "false"; // default: sandbox
export const C6_BASE = IS_SANDBOX
  ? "https://baas-api-sandbox.c6bank.info"
  : "https://baas-api.c6bank.info";

// ---------- helpers internos ----------

function getPem() {
  const certB64 = process.env.C6_CERT_PEM_B64;
  const keyB64 = process.env.C6_KEY_PEM_B64;
  if (!certB64 || !keyB64)
    throw new Error("C6 Bank: env vars C6_CERT_PEM_B64 / C6_KEY_PEM_B64 não configuradas");
  return {
    cert: Buffer.from(certB64, "base64").toString("utf-8"),
    key: Buffer.from(keyB64, "base64").toString("utf-8"),
  };
}

interface RawResponse { status: number; body: string }

function httpsRequest(
  urlStr: string,
  opts: { method: string; headers: Record<string, string>; cert: string; key: string },
  body?: string
): Promise<RawResponse> {
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
        res.on("data", (chunk: string) => (raw += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: raw }));
      }
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

// ---------- token (cache in-memory por cold-start) ----------

interface TokenCache { value: string; expiresAt: number }
let _cache: TokenCache | null = null;

export async function getToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && _cache && Date.now() < _cache.expiresAt) return _cache.value;

  const { cert, key } = getPem();
  const clientId = process.env.C6_CLIENT_ID ?? "";
  const clientSecret = process.env.C6_CLIENT_SECRET ?? "";
  if (!clientId || !clientSecret)
    throw new Error("C6 Bank: env vars C6_CLIENT_ID / C6_CLIENT_SECRET não configuradas");

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  }).toString();

  const res = await httpsRequest(
    `${C6_BASE}/v1/auth/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body).toString(),
        Accept: "application/json",
      },
      cert,
      key,
    },
    body
  );

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`C6 auth falhou: HTTP ${res.status} — ${res.body}`);
  }

  const data = JSON.parse(res.body) as { access_token: string; expires_in?: number };
  const ttl = (data.expires_in ?? 600) - 30; // 30s de margem
  _cache = { value: data.access_token, expiresAt: Date.now() + ttl * 1000 };
  return _cache.value;
}

// ---------- tipos do extrato ----------

export interface C6Transaction {
  /* campos que o C6 pode retornar — ajustamos após a 1ª chamada real */
  id?: string;
  transactionId?: string;
  date?: string;
  dateTime?: string;
  bookingDate?: string;
  description?: string;
  memo?: string;
  transactionInformation?: string;
  amount?: number;
  transactionAmount?: { amount: string; currency: string };
  creditDebitIndicator?: "CREDIT" | "DEBIT";
  status?: string;
  type?: string;
  balance?: { amount: { amount: string; currency: string } };
}

/** Resposta raw pode variar; tentamos as formas mais comuns */
function parseList(raw: unknown): C6Transaction[] {
  if (Array.isArray(raw)) return raw as C6Transaction[];
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    for (const key of ["data", "transactions", "items", "entries", "results"]) {
      if (Array.isArray(o[key])) return o[key] as C6Transaction[];
    }
  }
  return [];
}

// ---------- extrato ----------

export async function fetchExtrato(
  startDate: string,
  endDate: string
): Promise<{ transactions: C6Transaction[]; raw: unknown }> {
  const { cert, key } = getPem();
  const url = `${C6_BASE}/v1/statement/?start_date=${startDate}&end_date=${endDate}`;

  async function doRequest(token: string): Promise<RawResponse> {
    return httpsRequest(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cert,
      key,
    });
  }

  let token = await getToken();
  let res = await doRequest(token);

  if (res.status === 401) {
    // token expirado no servidor → renova e tenta de novo
    _cache = null;
    token = await getToken(true);
    res = await doRequest(token);
  }

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`C6 extrato falhou: HTTP ${res.status} — ${res.body}`);
  }

  const raw: unknown = JSON.parse(res.body);
  return { transactions: parseList(raw), raw };
}
