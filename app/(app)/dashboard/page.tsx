import { createClient } from "@/lib/supabaseServer";
import { StatCard, StatusBadge } from "@/components/Card";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    label: start.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
  };
}

export default async function DashboardPage() {
  const supabase = createClient();
  const { start, end, label } = monthRange();

  const [recebidoMes, pagoMes, aReceber, aPagar, proximosVencimentos] = await Promise.all([
    supabase
      .from("contas_receber")
      .select("valor")
      .eq("status", "recebido")
      .gte("data_recebimento", start)
      .lte("data_recebimento", end),
    supabase
      .from("contas_pagar")
      .select("valor")
      .eq("status", "pago")
      .gte("data_pagamento", start)
      .lte("data_pagamento", end),
    supabase
      .from("contas_receber")
      .select("valor")
      .in("status", ["pendente", "atrasado"]),
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
  ]);

  const sum = (rows: { valor: number }[] | null) =>
    (rows ?? []).reduce((acc, r) => acc + Number(r.valor), 0);

  const faturamento = sum(recebidoMes.data);
  const despesas = sum(pagoMes.data);
  const totalAReceber = sum(aReceber.data);
  const totalAPagar = sum(aPagar.data);
  const saldoMes = faturamento - despesas;

  return (
    <div>
      <div className="mb-6">
        <p className="font-display font-semibold text-xl text-ink capitalize">Painel — {label}</p>
        <p className="text-sm text-muted mt-0.5">Visão geral das finanças da agência</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="Faturamento do mês" value={formatBRL(faturamento)} hint="Recebido no período" tone="ledger" />
        <StatCard label="Despesas do mês" value={formatBRL(despesas)} hint="Pago no período" tone="crimson" />
        <StatCard label="Saldo do mês" value={formatBRL(saldoMes)} hint="Faturamento − despesas" tone={saldoMes >= 0 ? "ledger" : "crimson"} />
        <StatCard label="A receber em aberto" value={formatBRL(totalAReceber)} hint="Pendente + atrasado" tone="amber" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div className="bg-white rounded-md shadow-sm p-5">
          <p className="text-sm font-medium text-ink mb-1">Total a pagar em aberto</p>
          <p className="font-mono tabular text-2xl font-semibold text-crimson">{formatBRL(totalAPagar)}</p>
          <p className="text-xs text-muted mt-1">Somatório de contas pendentes e atrasadas</p>
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
