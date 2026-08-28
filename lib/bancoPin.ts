/**
 * PIN extra de proteção pra aba Banco C6. Compartilhado entre as 3 pessoas com
 * acesso, pedido toda vez que a aba é aberta (não fica salvo entre sessões).
 *
 * Fluxo: cliente envia o PIN pra /api/banco/verificar-pin. Se bater com
 * BANCO_PIN, o servidor devolve um token assinado (HMAC) válido por 15 min.
 * O cliente guarda esse token só em memória (nunca localStorage/sessionStorage)
 * e manda no header x-banco-pin-token em toda chamada às rotas do C6 Bank —
 * que verificam o token de novo no servidor antes de fazer qualquer coisa.
 */
import crypto from "node:crypto";

const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutos

function getSecret(): string {
  const secret = process.env.BANCO_PIN_SECRET;
  if (!secret) throw new Error("BANCO_PIN_SECRET não configurada");
  return secret;
}

export function checarPin(pinDigitado: string): boolean {
  const pinCorreto = process.env.BANCO_PIN;
  if (!pinCorreto) throw new Error("BANCO_PIN não configurada");
  // comparação em tempo constante pra não vazar informação por timing
  const a = Buffer.from(pinDigitado);
  const b = Buffer.from(pinCorreto);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function gerarToken(): string {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = String(exp);
  const sig = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function tokenValido(token: string | null | undefined): boolean {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const esperado = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  const exp = Number(payload);
  return Number.isFinite(exp) && Date.now() < exp;
}
