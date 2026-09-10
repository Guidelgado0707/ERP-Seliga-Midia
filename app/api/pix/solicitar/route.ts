import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { tokenValido } from "@/lib/bancoPin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/pix/solicitar
 * body: { destinatario_id, valor, descricao? }
 *
 * Cria uma solicitação de PIX aplicando as regras de segurança:
 * 1. Valor <= limite_por_transacao (senão rejeita)
 * 2. Soma do dia (todas as solicitações do dia com status != cancelada/falhou)
 *    + esse valor <= limite_por_dia (senão rejeita)
 * 3. Se valor < valor_requer_aprovacao → status "aprovada" auto (mas não enviada)
 * 4. Se valor >= valor_requer_aprovacao → status "pendente_aprovacao"
 *
 * Requer PIN da aba banco válido (header x-banco-pin-token).
 */
export async function POST(req: NextRequest) {
  if (!tokenValido(req.headers.get("x-banco-pin-token"))) {
    return NextResponse.json({ error: "PIN não verificado ou expirado" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const destinatario_id = body?.destinatario_id;
  const valor = Number(body?.valor);
  const descricao = body?.descricao ? String(body.descricao).trim().slice(0, 140) : null;

  if (!destinatario_id || !Number.isFinite(valor) || valor <= 0) {
    return NextResponse.json(
      { error: "body inválido: destinatario_id e valor > 0 obrigatórios" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // valida destinatário ativo
  const { data: dest, error: destErr } = await admin
    .from("pix_destinatarios")
    .select("id, nome, chave, tipo, ativo")
    .eq("id", destinatario_id)
    .single();
  if (destErr || !dest || !dest.ativo) {
    return NextResponse.json({ error: "destinatário não encontrado ou desativado" }, { status: 400 });
  }

  // busca limites atuais
  const { data: limites } = await admin.from("pix_limites").select("*").eq("id", 1).single();
  const limiteTx = Number(limites?.limite_por_transacao ?? 1000);
  const limiteDia = Number(limites?.limite_por_dia ?? 20000);
  const valorAprov = Number(limites?.valor_requer_aprovacao ?? 1000);

  // regra 1: limite por transação
  if (valor > limiteTx) {
    return NextResponse.json(
      { error: `valor R$ ${valor.toFixed(2)} passa do limite por transação (R$ ${limiteTx.toFixed(2)})` },
      { status: 400 },
    );
  }

  // regra 2: soma do dia
  const inicioDia = new Date();
  inicioDia.setHours(0, 0, 0, 0);
  const { data: doDia } = await admin
    .from("pix_solicitacoes")
    .select("valor")
    .gte("pedido_em", inicioDia.toISOString())
    .in("status", ["aprovada", "enviada", "pendente_aprovacao"]);
  const somaDia = (doDia ?? []).reduce((acc, r) => acc + Number(r.valor), 0);
  if (somaDia + valor > limiteDia) {
    return NextResponse.json(
      { error: `soma do dia (R$ ${(somaDia + valor).toFixed(2)}) passa do limite diário (R$ ${limiteDia.toFixed(2)})` },
      { status: 400 },
    );
  }

  // regra 3/4: aprovação automática se abaixo do gatilho
  const precisaAprovacao = valor >= valorAprov;
  const status = precisaAprovacao ? "pendente_aprovacao" : "aprovada";

  const { data: sol, error: solErr } = await admin
    .from("pix_solicitacoes")
    .insert({
      destinatario_id,
      valor,
      descricao,
      status,
      pedido_por: user.id,
      // auto-aprovada = o próprio pedido_por é o "aprovador" implícito.
      // MAS não podemos gravar aprovado_por = pedido_por (constraint chk_maker_checker).
      // Solução: só grava aprovado_por/aprovado_em quando é maker-checker de verdade.
      aprovado_por: null,
      aprovado_em: null,
    })
    .select()
    .single();
  if (solErr) return NextResponse.json({ error: solErr.message }, { status: 400 });

  // auditoria
  await admin.from("pix_auditoria").insert({
    solicitacao_id: sol.id,
    acao: "criada",
    ator: user.id,
    detalhes: { valor, destinatario: dest.nome, precisaAprovacao },
  });

  return NextResponse.json({ solicitacao: sol, precisaAprovacao });
}
