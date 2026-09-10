import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/pix/solicitacoes?status=pendente_aprovacao&limit=50
 * Lista as solicitações. UI usa pra mostrar pendentes de aprovação e histórico.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status");
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 50), 200);

  let q = supabase
    .from("pix_solicitacoes")
    .select("*, destinatario:pix_destinatarios(nome, chave, tipo)")
    .order("pedido_em", { ascending: false })
    .limit(limit);
  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ solicitacoes: data ?? [] });
}
