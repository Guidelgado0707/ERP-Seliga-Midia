import { createClient } from "@/lib/supabaseServer";
import { StatCard, StatusBadge } from "@/components/Card";
import MonthFilter from "@/components/MonthFilter";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function monthRange(year: number, monthIndex: number) {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function monthLabel(year: number, monthIndex: number) {
  const label = new Date(year, monthIndex, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function monthOptions() {
  const now = new Date();
  const options: { value: string; label: string }[] = [];
  for (let i = 0; i < 36; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    options.push({ value, label: monthLabel(d.getFullYear(), d.getMonth()) });
  }
  return options;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { mes?: string };
}) {
  const supabase = createClient();
  const now = new Date();

  let selectedYear = now.getFullYear();
  let selectedMonthIndex = now.getMonth(); // 0-indexed

  if (searchParams.mes) {
    const [y, m] = searchParams.mes.split("-").map(Number);
    if (y && m) {
      selectedYear = y;
      selectedMonthIndex = m - 1;
    }
  }

  const selectedMes = `${selectedYear}-${String(selectedMonthIndex + 1).padStart(2, "0")}`;
  const { start: mesStart, end: mesEnd } = monthRange(selectedYear, selectedMonthIndex);
  const yearStart = `${selectedYear}-01-01`;
  const yearEnd = `${selectedYear}-12-31`;
  const hoje = now.toISOString().slice(0, 10);

  const [
    anoRecebido,
    anoPago,
    mesProvisionado,
    mesFaturado,
    mesCusto,
    aPagarAberto,
    proximosVencimentos,
    lembretePagar,
    lembreteReceber,
  ] = await Promise.all([
    supabase
      .from("contas_receber")
      .select("valor")
      .eq("status", "recebido")
      .gte("data_recebimento", yearStart)
      .lte("data_recebimento", yearEnd),
    supabase
      .from("contas_pagar")
      .select("valor")
      .eq("status", "pago")
      .gte("data_pagamento", yearStart)
      .lte("data_pagamento", yearEnd),
    supabase
      .from("contas_receber")
      .select("valor")
      .gte("data_vencimento", mesStart)
      .lte("data_vencimento", mesEnd),
    supabase
      .from("contas_receber")
      .select("valor")
      .eq("status", "recebido")
      .gte("data_recebimento", mesStart)
      .lte("data_recebimento", mesEnd),
    supabase
      .from("contas_pagar")
      .select("valor")
      .eq("status", "pago")
      .gte("data_pagamento", mesStart)
      .lte("data_pagamento", mesEnd),
    supabase
      .from("contas_pagar")
      .select("valor")
      .in("status", ["pendente", "atrasado"]),
    supabase
      .from("contas_pagar")
      .select("id, descricao, fornecedor, valor, data_vencimento, status")
      .in("status", ["pendente", "atrasado"])
      .order("data_vencimento", { ascending: true })
      .limit(5),
    supabase
      .from("contas_pagar")
      .select("id, descricao, fornecedor, valor, data_vencimento")
      .eq("status", "pendente")
      .lte("data_vencimento", hoje)
      .order("data_vencimento", { ascending: true }),
    supabase
      .from("contas_receber")
      .select("id, descricao, cliente, valor, data_vencimento")
      .eq("status", "pendente")
      .lte("data_vencimento", hoje)
      .order("data_vencimento", { ascending: true }),
  ]);

  const sum = (rows: { valor: number }[] | null) =>
    (rows ?? []).reduce((acc, r) => acc + Number(r.valor), 0);

  const faturamentoAno = sum(anoRecebido.data);
  const custoAno = sum(anoPago.data);
  const saldoAno = faturamentoAno - custoAno;

  const provisionadoMes = sum(mesProvisionado.data);
  const faturamentoMes = sum(mesFaturado.data);
  const custoMes = sum(mesCusto.data);
  const saldoMes = faturamentoMes - custoMes;

  const totalAPagar = sum(aPagarAberto.data);

  const contasPagarLembrete = lembretePagar.data ?? [];
  const contasReceberLembrete = lembreteReceber.data ?? [];
  const temLembrete = contasPagarLembrete.length > 0 || contasReceberLembrete.length > 0;

  return (
    <div>
      <div className="mb-6">
        <p className="font-display font-semibold text-xl text-ink">Painel</p>
        <p className="text-sm text-muted mt-0.5">Visão geral das finanças da agência</p>
      </div>

      {temLembrete && (
        <div className="bg-amber-soft border border-amber/30 rounded-md p-5 mb-6">
          <p className="text-sm font-semibold text-ink mb-3">🔔 Lembrete de hoje</p>
          <div className="space-y-2">
            {contasPagarLembrete.map((c) => {
              const vencida = c.data_vencimento < hoje;
              return (
                <div key={`p-${c.id}`} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-ink">
                    {vencida ? "🔴 Venceu" : "🟡 Vence hoje"} — Pagar: {c.descricao}
                    {c.fornecedor ? ` (${c.fornecedor})` : ""}
                    {vencida &&
                      ` · ${new Date(c.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR")}`}
                  </span>
                  <span className="font-mono tabular text-ink shrink-0">{formatBRL(Number(c.valor))}</span>
                </div>
              );
            })}
            {contasReceberLembrete.map((c) => {
              const vencida = c.data_vencimento < hoje;
              return (
                <div key={`r-${c.id}`} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-ink">
                    {vencida ? "🔴 Venceu" : "🟡 Vence hoje"} — Receber: {c.descricao} ({c.cliente})
                    {vencida &&
                      ` · ${new Date(c.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR")}`}
                  </span>
                  <span className="font-mono tabular text-ink shrink-0">{formatBRL(Number(c.valor))}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ano */}
      <div className="mb-2">
        <p className="text-xs font-medium text-muted uppercase tracking-wide">Ano de {selectedYear}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-6">
        <StatCard
          label="Faturamento total do ano"
          value={formatBRL(faturamentoAno)}
          hint="Tudo que foi recebido no ano"
          tone="ledger"
        />
        <StatCard
          label="Custo total do ano"
          value={formatBRL(custoAno)}
          hint="Tudo que foi pago no ano"
          tone="crimson"
        />
        <StatCard
          label="Lucro líquido ano"
          value={formatBRL(saldoAno)}
          hint="Faturamento − custo"
          tone={saldoAno >= 0 ? "ledger" : "crimson"}
        />
      </div>

      {/* Mês selecionado */}
      <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
        <p className="text-xs font-medium text-muted uppercase tracking-wide">
          {monthLabel(selectedYear, selectedMonthIndex)}
        </p>
        <MonthFilter options={monthOptions()} selected={selectedMes} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label="Provisionado no mês"
          value={formatBRL(provisionadoMes)}
          hint="Faturas emitidas (pagas + pendentes)"
          tone="amber"
        />
        <StatCard
          label="Faturamento do mês"
          value={formatBRL(faturamentoMes)}
          hint="O que de fato entrou (recebido)"
          tone="ledger"
        />
        <StatCard
          label="Custo do mês"
          value={formatBRL(custoMes)}
          hint="Pago no período"
          tone="crimson"
        />
        <StatCard
          label="Lucro líquido mês"
          value={formatBRL(saldoMes)}
          hint="Faturamento − custo"
          tone={saldoMes >= 0 ? "ledger" : "crimson"}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div className="bg-white rounded-md shadow-sm p-5">
          <p className="text-sm font-medium text-ink mb-1">Total a pagar em aberto</p>
          <p className="font-mono tabular text-2xl font-semibold text-crimson">{formatBRL(totalAPagar)}</p>
          <p className="text-xs text-muted mt-1">Somatório de contas pendentes e atrasadas (todos os meses)</p>
        </div>
        <div className="bg-white rounded-md shadow-sm p-5">
          <p className="text-sm font-medium text-ink mb-1">Fechamento pro contador</p>
          <p className="text-xs text-muted mt-1 leading-relaxed">
            No fim do mês, exporte as contas a pagar e a receber em CSV nas respectivas páginas
            e envie pro seu contador junto com as notas fiscais registradas em "Notas".
          </p>
        </div>
      </div>

      <div className="bg-white rounded-md shadow-sm mt-4">
        <div className="px-5 py-4 border-b border-line">
          <p className="text-sm font-medium text-ink">Próximos vencimentos (a pagar)</p>
        </div>
        <div className="divide-y divide-line">
          {(proximosVencimentos.data ?? []).length === 0 && (
            <p className="px-5 py-6 text-sm text-muted">Nenhuma conta a pagar pendente. 🎉</p>
          )}
          {(proximosVencimentos.data ?? []).map((c) => (
            <div key={c.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink truncate">{c.descricao}</p>
                <p className="text-xs text-muted">
                  {c.fornecedor || "—"} · vence em{" "}
                  {new Date(c.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR")}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-mono tabular text-sm text-ink">{formatBRL(Number(c.valor))}</span>
                <StatusBadge status={c.status} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
