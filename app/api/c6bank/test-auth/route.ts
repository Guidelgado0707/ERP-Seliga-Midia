/**
 * Rota de diagnóstico: testa apenas a autenticação C6 (mTLS + OAuth2).
 * Útil para isolar se o problema é no auth ou no extrato.
 */
import { NextResponse } from "next/server";
import { getToken, C6_BASE } from "@/lib/c6bank";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const t0 = Date.now();
  try {
    const token = await getToken(true); // força refresh
    const elapsed = Date.now() - t0;
    return NextResponse.json({
      ok: true,
      tokenPrefix: token.slice(0, 20) + "…",
      tokenLength: token.length,
      elapsedMs: elapsed,
      env: C6_BASE,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: msg, elapsedMs: Date.now() - t0 },
      { status: 500 }
    );
  }
}
