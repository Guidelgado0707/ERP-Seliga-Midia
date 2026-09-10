import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { tokenValido } from "@/lib/bancoPin";
import { enviarPix } from "@/lib/c6bank";
import { notificarEmail, msgPixEnviado } from "@/lib/notif";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/pix/enviar
 * body: { solicitacao_id }
 *
 * Executa o envio de verdade contra o C6:
 * 1. Valida PIN + auth
 * 2. Confirma que a solicitação existe e está "aprovada" (não pendente, não enviada)
 * 3. Chama enviarPix() do lib/c6bank.ts
 * 4. Grava resposta + status "enviada" ou "falhou"
 * 5. Notifica WhatsApp dos sócios
 * 6. Grava auditoria
 *
 * Regra crítica: SÓ envia se status == "aprovada". Isso impede um endpoint
 * malicioso ou bug de UI mandar antes da aprovação.
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
  if (!id) return NextResponse.json({ error: "solicitacao_id obrigatório" }, { status: 400 });

  const admin = createAdminClient();

  // busca solicitação + destinatário
  const { data: sol } = await admin
    .from("pix_solicitacoes")
    .select("*, destinatario:pix_destinatarios(id, nome, chave, tipo, ativo)")
    .eq("id", id)
    .single();
  if (!sol) return NextResponse.json({ error: "solicitação não encontrada" }, { status: 404 });
  if (sol.status !== "aprovada") {
    return NextResponse.json({ error: `só envia solicitação aprovada. status atual: ${sol.status}` }, { status: 400 });
  }
  if (!sol.destinatario?.ativo) {
    return NextResponse.json({ error: "destinatário foi desativado — cancele e recrie" }, { status: 400 });
  }

  // clientRequestId: usamos o id da solicitação. Se o C6 rejeitar por
  // idempotência (já mandamos antes), quer dizer que já foi processado.
  const clientRequestId = sol.id;

  let resposta: { status: number; body: unknown; requestBody: unknown };
  try {
    resposta = await enviarPix({
      chave: sol.destinatario.chave,
      tipoChave: sol.destinatario.tipo,
      valor: Number(sol.valor),
      descricao: sol.descricao ?? undefined,
      clientRequestId,
    });
  } catch (e) {
    const erro = (e as Error).message ?? String(e);
    await admin
      .from("pix_solicitacoes")
      .update({ status: "falhou", erro, enviado_em: new Date().toISOString() })
      .eq("id", id);
    await admin.from("pix_auditoria").insert({
      solicitacao_id: id, acao: "falhou", ator: user.id, detalhes: { erro },
    });
    return NextResponse.json({ error: erro }, { status: 502 });
  }

  const ok = resposta.status >= 200 && resposta.status < 300;
  const endToEnd = (resposta.body as { endToEndId?: string })?.endToEndId ?? null;

  await admin
    .from("pix_solicitacoes")
    .update({
      status: ok ? "enviada" : "falhou",
      end_to_end_id: endToEnd,
      resposta_c6: resposta.body as object,
      enviado_em: new Date().toISOString(),
      erro: ok ? null : `HTTP ${resposta.status}: ${JSON.stringify(resposta.body).slice(0, 500)}`,
    })
    .eq("id", id);

  await admin.from("pix_auditoria").insert({
    solicitacao_id: id,
    acao: ok ? "enviada" : "falhou",
    ator: user.id,
    detalhes: { httpStatus: resposta.status, endToEnd, precisouAprovacao: sol.aprovado_por != null },
  });

  // notificação: só dispara se enviou de verdade
  if (ok) {
    // pega email dos sócios pra montar mensagem legível (nome deles fica no
    // metadata do user.email ou fallback pra 'sócio')
    const nomeCurto = (email?: string | null) => (email ?? "").split("@")[0] || "sócio";
    const { data: pedidoPorUser } = await admin.auth.admin.getUserById(sol.pedido_por);
    const { data: aprovadoPorUser } = sol.aprovado_por
      ? await admin.auth.admin.getUserById(sol.aprovado_por)
      : { data: null };
    const { assunto, corpo } = msgPixEnviado({
      valor: Number(sol.valor),
      destinatario: sol.destinatario.nome,
      descricao: sol.descricao ?? undefined,
      pedido_por: nomeCurto(pedidoPorUser?.user?.email),
      aprovado_por: aprovadoPorUser?.user ? nomeCurto(aprovadoPorUser.user.email) : undefined,
      end_to_end_id: endToEnd ?? undefined,
    });
    const notif = await notificarEmail(assunto, corpo);
    if (!notif.enviado) {
      // não interrompe — o PIX já saiu. Só registra na auditoria.
      await admin.from("pix_auditoria").insert({
        solicitacao_id: id, acao: "notificacao_falhou", ator: user.id, detalhes: { erro: notif.erro },
      });
    }
  }

  return NextResponse.json({ ok, status: resposta.status, endToEnd, body: resposta.body });
}
