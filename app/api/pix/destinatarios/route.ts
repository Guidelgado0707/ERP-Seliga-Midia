import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/pix/destinatarios
 *   Lista destinatários ativos.
 *
 * POST /api/pix/destinatarios
 *   Cadastra novo destinatário.
 *   body: { nome, chave, tipo, observacao? }
 *
 * PATCH /api/pix/destinatarios?id=xxx
 *   Desativa (marca ativo=false, não deleta — pra histórico da auditoria).
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data, error } = await supabase
    .from("pix_destinatarios")
    .select("id, nome, chave, tipo, observacao, ativo, cadastrado_em")
    .eq("ativo", true)
    .order("nome");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ destinatarios: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || !body.nome || !body.chave || !body.tipo) {
    return NextResponse.json(
      { error: "body inválido: nome, chave, tipo são obrigatórios" },
      { status: 400 },
    );
  }
  if (!["cpf", "cnpj", "email", "telefone", "aleatoria"].includes(body.tipo)) {
    return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("pix_destinatarios")
    .insert({
      nome: String(body.nome).trim(),
      chave: String(body.chave).trim(),
      tipo: body.tipo,
      observacao: body.observacao ? String(body.observacao).trim() : null,
      cadastrado_por: user.id,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ destinatario: data });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("pix_destinatarios")
    .update({ ativo: false, desativado_por: user.id, desativado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
