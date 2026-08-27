/**
 * Rota de teste: cria uma cobrança PIX imediata no sandbox C6.
 * Usada apenas para gerar uma movimentação de teste e validar
 * o fluxo completo (PIX → aparece no extrato).
 */
import { NextResponse } from "next/server";
import { createPixCharge } from "@/lib/c6bank";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST() {
  const chave = process.env.C6_PIX_KEY;
  if (!chave) {
    return NextResponse.json(
      { error: "Env var C6_PIX_KEY não configurada" },
      { status: 500 }
    );
  }

  try {
    const result = await createPixCharge({
      valor: "10.00",
      chave,
      devedorCpf: "11144477735", // CPF de teste válido (comum em sandboxes)
      devedorNome: "Cliente Teste ERP",
      solicitacaoPagador: "Cobrança de teste gerada pelo ERP Seliga Mídia",
    });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
