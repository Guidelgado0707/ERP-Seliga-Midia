import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { tokenValido } from "@/lib/bancoPin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/pix/aprovar
 * body: { solicitacao_id, acao: 'aprovar' | 'cancelar' }
 *
 * Aprovar: valida maker-checker (quem aprova ≠ quem pediu) e muda status pra "aprovada".
 * Cancelar: qualquer sócio pode cancelar solicitação pendente (inclusive quem pediu).
 *
 * Requer PIN da aba banco.
 */
export async function POST(req: NextRequest) {
  if (!tokenValido(req.headers.get("x-banco-pin-token"))) {
    return NextResponse.json({ error: "PIN não verificado ou expirado" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const id = body?.solicitacao_id;
  const acao = body?.acao;
  if (!id || !["aprovar", "cancelar"].includes(acao)) {
    return NextResponse.json({ error: "body inválido: solicitacao_id + acao (aprovar|cancelar)" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: sol, error: solErr } = await admin
    .from("pix_solicitacoes")
    .select("*")
    .eq("id", id)
    .single();
  if (solErr || !sol) return NextResponse.json({ error: "solicitação não encontrada" }, { status: 404 });
  if (sol.status !== "pendente_aprovacao") {
    return NextResponse.json({ error: `solicitação não está pendente (status atual: ${sol.status})` }, { status: 400 });
  }

  if (acao === "cancelar") {
    const { error: updErr } = await admin
      .from("pix_solicitacoes")
      .update({ status: "cancelada" })
      .eq("id", id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });
    await admin.from("pix_auditoria").insert({
      solicitacao_id: id, acao: "cancelada", ator: user.id, detalhes: { motivo: "cancelada por usuário" },
    });
    return NextResponse.json({ ok: true, status: "cancelada" });
  }

  // aprovar — maker-checker: quem aprova NÃO pode ser o mesmo que pediu
  if (sol.pedido_por === user.id) {
    return NextResponse.json(
      { error: "aprovação dupla: você não pode aprovar a própria solicitação. Outro sócio precisa aprovar." },
      { status: 403 },
    );
  }

  const { error: updErr } = await admin
    .from("pix_solicitacoes")
    .update({ status: "aprovada", aprovado_por: user.id, aprovado_em: new Date().toISOString() })
    .eq("id", id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });

  await admin.from("pix_auditoria").insert({
    solicitacao_id: id, acao: "aprovada", ator: user.id, detalhes: {},
  });

  return NextResponse.json({ ok: true, status: "aprovada" });
}
