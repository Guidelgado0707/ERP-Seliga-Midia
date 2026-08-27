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

/** Formato real confirmado na documentação C6 BaaS v1 */
export interface C6Transaction {
  local_reference?: string;   // referência local
  created_at?: string;        // "2025-12-05T14:30:00"
  entry_date?: string;        // "2025-12-05"
  amount?: string;            // "1500.00" (string, sempre positivo)
  title?: string;             // descrição curta
  description?: string;       // descrição completa
  reference?: string;         // UUID
  operation_type?: "INCOMING" | "OUTGOING" | string;
  transaction_type?: string;  // ex: "CREDIT_QRCODE_PIX_PAYMENT_RECEIVED"
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

/** Requisição HTTPS simples sem cert de cliente (só TLS padrão + Bearer) */
function httpsRequestSimple(
  urlStr: string,
  opts: { method: string; headers: Record<string, string> }
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
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk: string) => (raw += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: raw }));
      }
    );
    req.on("error", reject);
    req.end();
  });
}

export async function fetchExtrato(
  startDate: string,
  endDate: string
): Promise<{ transactions: C6Transaction[]; raw: unknown }> {
  const url = `${C6_BASE}/v1/statement/?start_date=${startDate}&end_date=${endDate}`;

  async function doRequest(token: string): Promise<RawResponse> {
    // C6 exige mTLS (cert+key) em TODOS os endpoints, incluindo /statement/
    // O Bearer token entra como camada extra de autenticação no header.
    const { cert, key } = getPem();
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

// ---------- PIX (cobrança imediata) ----------

/**
 * Cria uma cobrança PIX imediata (sem txid) seguindo o padrão oficial do
 * Bacen (BR Code / API Pix). Confirmado na doc C6: POST /v2/pix/cob
 * (note a versão v2, diferente do /v1/ usado em auth e statement).
 */
export async function createPixCharge(params: {
  valor: string; // ex: "10.00"
  chave: string; // chave PIX do recebedor
  devedorCpf?: string;
  devedorNome?: string;
  expiracaoSegundos?: number;
  solicitacaoPagador?: string;
}): Promise<{ status: number; body: unknown; requestBody: unknown }> {
  const { cert, key } = getPem();
  const token = await getToken();

  const payload: Record<string, unknown> = {
    calendario: { expiracao: params.expiracaoSegundos ?? 3600 },
    valor: { original: params.valor },
    chave: params.chave,
  };
  if (params.devedorCpf) {
    payload.devedor = { cpf: params.devedorCpf, nome: params.devedorNome ?? "Cliente Teste" };
  }
  if (params.solicitacaoPagador) {
    payload.solicitacaoPagador = params.solicitacaoPagador;
  }

  const body = JSON.stringify(payload);
  const url = `${C6_BASE}/v2/pix/cob`;

  const res = await httpsRequest(
    url,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body).toString(),
        Accept: "application/json",
      },
      cert,
      key,
    },
    body
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(res.body);
  } catch {
    parsed = res.body;
  }

  return { status: res.status, body: parsed, requestBody: payload };
}
