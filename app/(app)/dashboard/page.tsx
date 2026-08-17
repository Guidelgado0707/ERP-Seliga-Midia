import { createClient } from "@/lib/supabaseServer";
import { StatCard, StatusBadge } from "@/components/Card";
import MonthFilter from "@/components/MonthFilter";
import YearFilter from "@/components/YearFilter";
import RefreshButton from "@/components/RefreshButton";
import CaixaCard from "@/components/CaixaCard";

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

function yearOptions() {
  const now = new Date();
  const options: { value: string; label: string }[] = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 5; y--) {
    options.push({ value: String(y), label: String(y) });
  }
  return options;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { mes?: string; ano?: string };
}) {
  const supabase = createClient();
  const now = new Date();

  let selectedMonthYear = now.getFullYear();
  let selectedMonthIndex = now.getMonth(); // 0-indexed

  if (searchParams.mes) {
    const [y, m] = searchParams.mes.split("-").map(Number);
    if (y && m) {
      selectedMonthYear = y;
      selectedMonthIndex = m - 1;
    }
  }

  const selectedAno = searchParams.ano ? Number(searchParams.ano) : now.getFullYear();

  const selectedMes = `${selectedMonthYear}-${String(selectedMonthIndex + 1).padStart(2, "0")}`;
  const { start: mesStart, end: mesEnd } = monthRange(selectedMonthYear, selectedMonthIndex);
  const yearStart = `${selectedAno}-01-01`;
  const yearEnd = `${selectedAno}-12-31`;
  const hoje = now.toISOString().slice(0, 10);

  const [
    anoRecebido,
    anoPago,
    anoRecebidoJC,
    anoPagoJC,
    ajustesJCAno,
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
      .eq("origem", "seliga_midia")
      .eq("reembolso", false)
      .gte("data_recebimento", yearStart)
      .lte("data_recebimento", yearEnd),
    supabase
      .from("contas_pagar")
      .select("valor")
      .eq("status", "pago")
      .eq("origem", "seliga_midia")
      .gte("data_pagamento", yearStart)
      .lte("data_pagamento", yearEnd),
    supabase
      .from("contas_receber")
      .select("valor, data_recebimento")
      .eq("status", "recebido")
      .eq("origem", "projeto_jc")
      .gte("data_recebimento", yearStart)
      .lte("data_recebimento", yearEnd),
    supabase
      .from("contas_pagar")
      .select("valor, data_pagamento")
      .eq("status", "pago")
      .eq("origem", "projeto_jc")
      .gte("data_pagamento", yearStart)
      .lte("data_pagamento", yearEnd),
    supabase
      .from("projeto_jc_ajustes")
      .select("mes, lucro_liquido")
      .like("mes", `${selectedAno}-%`),
    supabase
      .from("contas_receber")
      .select("valor")
      .eq("origem", "seliga_midia")
      .eq("reembolso", false)
      .gte("data_vencimento", mesStart)
      .lte("data_vencimento", mesEnd),
    supabase
      .from("contas_receber")
      .select("valor")
      .eq("status", "recebido")
      .eq("origem", "seliga_midia")
      .eq("reembolso", false)
      .gte("data_recebimento", mesStart)
      .lte("data_recebimento", mesEnd),
    supabase
      .from("contas_pagar")
      .select("valor")
      .eq("status", "pago")
      .eq("origem", "seliga_midia")
      .gte("data_pagamento", mesStart)
      .lte("data_pagamento", mesEnd),
    supabase
      .from("contas_pagar")
      .select("valor")
      .eq("origem", "seliga_midia")
      .in("status", ["pendente", "atrasado"]),
    supabase
      .from("contas_pagar")
      .select("id, descricao, fornecedor, valor, data_vencimento, status")
      .eq("origem", "seliga_midia")
      .in("status", ["pendente", "atrasado"])
      .order("data_vencimento", { ascending: true })
      .limit(5),
    supabase
      .from("contas_pagar")
      .select("id, descricao, fornecedor, valor, data_vencimento")
      .eq("status", "pendente")
      .eq("origem", "seliga_midia")
      .lte("data_vencimento", hoje)
      .order("data_vencimento", { ascending: true }),
    supabase
      .from("contas_receber")
      .select("id, descricao, cliente, valor, data_vencimento")
      .eq("status", "pendente")
      .eq("origem", "seliga_midia")
      .lte("data_vencimento", hoje)
      .order("data_vencimento", { ascending: true }),
  ]);

  const caixaRefRes = await supabase
    .from("caixa_referencia")
    .select("conta, data_referencia, valor, created_at")
    .order("data_referencia", { ascending: false })
    .order("created_at", { ascending: false });

  const todasReferencias = caixaRefRes.data ?? [];
  const refContaCorrente = todasReferencias.find((r) => r.conta === "Conta Corrente") ?? null;
  const refReserva = todasReferencias.find((r) => r.conta === "Reserva de Emergência") ?? null;

  const sumLocal = (rows: { valor: number }[] | null) =>
    (rows ?? []).reduce((acc, r) => acc + Number(r.valor), 0);

  let saldoContaCorrente = 0;
  if (refContaCorrente) {
    // o valor informado já reflete o saldo no momento exato em que foi salvo
    // (created_at) — então só soma/subtrai o que foi marcado como pago/recebido
    // DEPOIS desse instante, mesmo que no mesmo dia.
    // Sem filtro de origem de propósito: Projeto JC usa a mesma conta corrente
    // da Seliga Mídia, então precisa entrar nesse saldo também.
    const [recebidoDesde, pagoDesde, dividendosPagosDesde] = await Promise.all([
      supabase
        .from("contas_receber")
        .select("valor")
        .eq("status", "recebido")
        .gt("recebido_em", refContaCorrente.created_at),
      supabase
        .from("contas_pagar")
        .select("valor")
        .eq("status", "pago")
        .gt("pago_em", refContaCorrente.created_at),
      // dividendos pagos aos sócios também saem da Conta Corrente, mesmo não sendo
      // despesa na DRE (distribuição de lucro já apurado, não custo operacional).
      supabase
        .from("dividendos_socios")
        .select("valor")
        .eq("pago", true)
        .gt("pago_em", refContaCorrente.created_at),
    ]);
    saldoContaCorrente =
      Number(refContaCorrente.valor) +
      sumLocal(recebidoDesde.data) -
      sumLocal(pagoDesde.data) -
      sumLocal(dividendosPagosDesde.data);
  }

  // Reserva de emergência fica parada — não some/soma com contas a pagar/receber.
  const saldoReserva = refReserva ? Number(refReserva.valor) : 0;

  const sum = (rows: { valor: number }[] | null) =>
    (rows ?? []).reduce((acc, r) => acc + Number(r.valor), 0);

  const faturamentoAnoSeliga = sum(anoRecebido.data);
  const custoAnoSeliga = sum(anoPago.data);

  // Projeto JC entra na linha do Ano (faturamento/custo/lucro total da operação),
  // mas continua fora das linhas de mês e da DRE da Seliga Mídia.
  const somarPorMes = (rows: { valor: number; [key: string]: any }[] | null, campoData: string) => {
    const totals = new Map<string, number>();
    for (const r of rows ?? []) {
      const mesKey = String(r[campoData]).slice(0, 7);
      totals.set(mesKey, (totals.get(mesKey) ?? 0) + Number(r.valor));
    }
    return totals;
  };
  const recebidoJCPorMes = somarPorMes(anoRecebidoJC.data, "data_recebimento");
  const pagoJCPorMes = somarPorMes(anoPagoJC.data, "data_pagamento");
  const ajustesPorMes = new Map((ajustesJCAno.data ?? []).map((a) => [a.mes, Number(a.lucro_liquido)]));

  const faturamentoJCAno = sum(anoRecebidoJC.data as { valor: number }[]);
  const custoJCAno = sum(anoPagoJC.data as { valor: number }[]);

  const mesesComJC = new Set([...recebidoJCPorMes.keys(), ...pagoJCPorMes.keys(), ...ajustesPorMes.keys()]);
  let lucroJCAno = 0;
  for (const mesKey of mesesComJC) {
    const ajuste = ajustesPorMes.get(mesKey);
    lucroJCAno += ajuste !== undefined ? ajuste : (recebidoJCPorMes.get(mesKey) ?? 0) - (pagoJCPorMes.get(mesKey) ?? 0);
  }

  const faturamentoAno = faturamentoAnoSeliga + faturamentoJCAno;
  const custoAno = custoAnoSeliga + custoJCAno;
  const saldoAno = faturamentoAnoSeliga - custoAnoSeliga + lucroJCAno;

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
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <p className="font-display font-semibold text-xl text-ink">Painel</p>
          <p className="text-sm text-muted mt-0.5">Visão geral das finanças da agência</p>
        </div>
        <RefreshButton />
      </div>

      <CaixaCard
        contaCorrente={{ saldo: saldoContaCorrente, dataReferencia: refContaCorrente?.data_referencia ?? null }}
        reserva={{ saldo: saldoReserva, dataReferencia: refReserva?.data_referencia ?? null }}
        temReferencia={todasReferencias.length > 0}
      />

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
      <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
        <p className="text-xs font-medium text-muted uppercase tracking-wide">Ano de {selectedAno}</p>
        <YearFilter options={yearOptions()} selected={String(selectedAno)} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-6">
        <StatCard
          label="Faturamento total do ano"
          value={formatBRL(faturamentoAno)}
          hint="Recebido no ano — Seliga Mídia + Projeto JC"
          tone="ledger"
        />
        <StatCard
          label="Custo total do ano"
          value={formatBRL(custoAno)}
          hint="Pago no ano — Seliga Mídia + Projeto JC"
          tone="crimson"
        />
        <StatCard
          label="Lucro líquido ano"
          value={formatBRL(saldoAno)}
          hint="Seliga Mídia + lucro líquido do Projeto JC (com ajustes manuais, quando houver)"
          tone={saldoAno >= 0 ? "ledger" : "crimson"}
        />
      </div>

      {/* Mês selecionado */}
      <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
        <p className="text-xs font-medium text-muted uppercase tracking-wide">
          {monthLabel(selectedMonthYear, selectedMonthIndex)}
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
