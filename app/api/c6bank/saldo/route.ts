import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { fetchExtrato, type C6Transaction } from "@/lib/c6bank";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/c6bank/saldo
 *   Retorna { saldo_atual, entrou_mes, saiu_mes, data_ref, saldo_ref, atualizado_em }.
 *   Calcula: saldo_atual = saldo_ref + sum(entradas desde data_ref) − sum(saídas desde data_ref).
 *   Como o C6 limita 30 dias por chamada, quebra o range em janelas.
 *
 * POST /api/c6bank/saldo
 *   Body: { saldo, data, observacao? }
 *   Atualiza o snapshot (chamado quando o user quer "resetar" o saldo inicial).
 *
 * Ambos exigem 2FA + login (não usam PIN da aba banco pra manter tela do Painel
 * usável sem PIN — saldo é só leitura de agregado, não faz movimento).
 */

const SP_TZ = "America/Sao_Paulo";
function hojeSP(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: SP_TZ }); // YYYY-MM-DD
}
function inicioMesSP(): string {
  const s = hojeSP();
  return s.slice(0, 8) + "01";
}
function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function n(tx: C6Transaction): number { return parseFloat(tx.amount ?? "0") || 0; }

/**
 * Puxa extrato entre 2 datas quebrando em janelas de <= 30 dias (limite C6).
 * Deduplica por reference/local_reference.
 */
async function fetchExtratoLongo(inicio: string, fim: string): Promise<C6Transaction[]> {
  const janelas: [string, string][] = [];
  let cursor = inicio;
  while (cursor <= fim) {
    const proximaFim = addDays(cursor, 29);
    const fimJanela = proximaFim > fim ? fim : proximaFim;
    janelas.push([cursor, fimJanela]);
    cursor = addDays(fimJanela, 1);
  }
  const todas: C6Transaction[] = [];
  const vistos = new Set<string>();
  for (const [ini, fi] of janelas) {
    const { transactions } = await fetchExtrato(ini, fi);
    for (const tx of transactions) {
      const key = tx.reference ?? tx.local_reference ?? `${tx.entry_date}|${tx.amount}|${tx.title}`;
      if (vistos.has(key)) continue;
      vistos.add(key);
      todas.push(tx);
    }
  }
  return todas;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  // pega snapshot
  const { data: snap } = await supabase.from("banco_saldo_snapshot").select("*").eq("id", 1).maybeSingle();
  if (!snap) {
    return NextResponse.json({
      configurado: false,
      msg: "Nenhum saldo de referência definido. Use POST pra registrar o saldo atual da conta.",
    });
  }

  try {
    const hoje = hojeSP();
    const inicioMes = inicioMesSP();
    // pega extrato desde data_ref (ou início do mês, o que for mais antigo, pra calcular entrou/saiu do mês)
    const inicioBusca = snap.data_ref < inicioMes ? snap.data_ref : inicioMes;
    const txs = await fetchExtratoLongo(inicioBusca, hoje);

    // pra saldo: soma tudo desde data_ref (inclusive)
    let entradasDesdeRef = 0, saidasDesdeRef = 0;
    let entradasMes = 0, saidasMes = 0;
    // breakdown por transaction_type do C6 — pro user entender o que compõe o mês
    const porTipoMes: Record<string, { entrada: number; saida: number; qtd: number }> = {};
    for (const tx of txs) {
      const d = tx.entry_date ?? tx.created_at?.slice(0, 10) ?? "";
      if (!d) continue;
      const valor = n(tx);
      const isOut = tx.operation_type === "OUTGOING";
      // ESTRITAMENTE depois de data_ref — assumimos que o saldo informado já
      // reflete todas as transações do dia da referência (fim do dia). Se
      // somássemos as do próprio dia, contaríamos duas vezes.
      if (d > snap.data_ref) {
        if (isOut) saidasDesdeRef += valor;
        else entradasDesdeRef += valor;
      }
      // desde o início do mês — usadas pros cards de movimento
      if (d >= inicioMes) {
        if (isOut) saidasMes += valor;
        else entradasMes += valor;
        const t = tx.transaction_type ?? "OTHER";
        const b = (porTipoMes[t] ??= { entrada: 0, saida: 0, qtd: 0 });
        if (isOut) b.saida += valor; else b.entrada += valor;
        b.qtd += 1;
      }
    }

    const saldoAtual = Number(snap.saldo_ref) + entradasDesdeRef - saidasDesdeRef;

    return NextResponse.json({
      configurado: true,
      saldo_atual: Number(saldoAtual.toFixed(2)),
      entrou_mes: Number(entradasMes.toFixed(2)),
      saiu_mes: Number(saidasMes.toFixed(2)),
      data_ref: snap.data_ref,
      saldo_ref: Number(snap.saldo_ref),
      atualizado_em: snap.atualizado_em,
      hoje,
      // breakdown por tipo pra o card conseguir mostrar detalhe
      breakdown_mes: Object.entries(porTipoMes)
        .map(([tipo, v]) => ({ tipo, entrada: Number(v.entrada.toFixed(2)), saida: Number(v.saida.toFixed(2)), qtd: v.qtd }))
        .sort((a, b) => (b.entrada + b.saida) - (a.entrada + a.saida)),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message ?? String(e) }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const saldo = Number(body?.saldo);
  const data = String(body?.data ?? "");
  const observacao = body?.observacao ? String(body.observacao).slice(0, 200) : null;
  if (!Number.isFinite(saldo) || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return NextResponse.json({ error: "body inválido: saldo (número) e data (YYYY-MM-DD) obrigatórios" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("banco_saldo_snapshot").upsert({
    id: 1,
    saldo_ref: saldo,
    data_ref: data,
    observacao,
    atualizado_por: user.id,
    atualizado_em: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
