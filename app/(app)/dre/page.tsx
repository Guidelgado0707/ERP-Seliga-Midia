import { createClient } from "@/lib/supabaseServer";
import MonthFilter from "@/components/MonthFilter";
import YearFilter from "@/components/YearFilter";
import { DreLinha } from "@/components/DreLinha";
import { monthRange, monthLabel, monthOptions, yearOptions } from "@/lib/dateUtils";

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type ContaRow = { valor: number; categoria_id: string | null };
type Categoria = { id: string; nome: string; tipo_custo: string | null };

function agruparPorCategoria(rows: ContaRow[], nomeMap: Map<string, string>) {
  const totals = new Map<string, number>();
  for (const r of rows) {
    const nome = r.categoria_id ? nomeMap.get(r.categoria_id) ?? "Sem categoria" : "Sem categoria";
    totals.set(nome, (totals.get(nome) ?? 0) + Number(r.valor));
  }
  return Array.from(totals, ([nome, valor]) => ({ nome, valor }));
}

function montarDRE(receitaRows: ContaRow[], pagarRows: ContaRow[], categorias: Categoria[]) {
  const nomeMap = new Map(categorias.map((c) => [c.id, c.nome]));
  const tipoCustoPorNome = new Map(categorias.map((c) => [c.nome, c.tipo_custo]));

  const receitas = agruparPorCategoria(receitaRows, nomeMap).sort((a, b) => b.valor - a.valor);
  const receitaBruta = receitas.reduce((acc, r) => acc + r.valor, 0);

  const porCategoriaPagar = agruparPorCategoria(pagarRows, nomeMap);
  const impostos = porCategoriaPagar.find((d) => d.nome === "Impostos")?.valor ?? 0;
  const despesasSemImposto = porCategoriaPagar.filter((d) => d.nome !== "Impostos");

  // categoria sem tipo_custo definido (inclui "Sem categoria") cai em variável por padrão
  const despesasFixas = despesasSemImposto
    .filter((d) => tipoCustoPorNome.get(d.nome) === "fixo")
    .sort((a, b) => b.valor - a.valor);
  const despesasVariaveis = despesasSemImposto
    .filter((d) => tipoCustoPorNome.get(d.nome) !== "fixo")
    .sort((a, b) => b.valor - a.valor);

  const totalFixas = despesasFixas.reduce((acc, d) => acc + d.valor, 0);
  const totalVariaveis = despesasVariaveis.reduce((acc, d) => acc + d.valor, 0);

  const receitaLiquida = receitaBruta - impostos;
  const totalDespesas = totalFixas + totalVariaveis;
  const resultadoLiquido = receitaLiquida - totalDespesas;
  const margem = receitaBruta > 0 ? (resultadoLiquido / receitaBruta) * 100 : 0;

  // margem de contribuição = quanto sobra da receita líquida depois dos custos variáveis
  const margemContribuicao = receitaLiquida > 0 ? (receitaLiquida - totalVariaveis) / receitaLiquida : 0;
  const pontoEquilibrio = margemContribuicao > 0 ? totalFixas / margemContribuicao : null;

  return {
    receitas,
    receitaBruta,
    impostos,
    receitaLiquida,
    despesasFixas,
    despesasVariaveis,
    totalFixas,
    totalVariaveis,
    totalDespesas,
    resultadoLiquido,
    margem,
    margemContribuicao,
    pontoEquilibrio,
  };
}

function DREBloco({ dre }: { dre: ReturnType<typeof montarDRE> }) {
  return (
    <div className="bg-white rounded-md shadow-sm overflow-hidden">
      <div className="px-5 pt-3 pb-1">
        <p className="text-xs font-medium text-muted uppercase tracking-wide">Receita</p>
      </div>
      {dre.receitas.length === 0 && (
        <p className="px-5 pb-2 text-sm text-muted">Nenhuma receita categorizada neste período.</p>
      )}
      {dre.receitas.map((r) => (
        <DreLinha key={r.nome} label={r.nome} value={r.valor} indent />
      ))}
      <DreLinha label="Receita bruta" value={dre.receitaBruta} variant="subtotal" />

      <DreLinha label="(-) Impostos" value={-dre.impostos} indent />
      <DreLinha label="= Receita líquida" value={dre.receitaLiquida} variant="subtotal" />

      <div className="px-5 pt-3 pb-1">
        <p className="text-xs font-medium text-muted uppercase tracking-wide">Despesas fixas</p>
      </div>
      {dre.despesasFixas.length === 0 && (
        <p className="px-5 pb-2 text-sm text-muted">Nenhuma despesa fixa categorizada neste período.</p>
      )}
      {dre.despesasFixas.map((d) => (
        <DreLinha key={d.nome} label={d.nome} value={-d.valor} indent />
      ))}
      <DreLinha label="(-) Total despesas fixas" value={-dre.totalFixas} variant="subtotal" />

      <div className="px-5 pt-3 pb-1">
        <p className="text-xs font-medium text-muted uppercase tracking-wide">Despesas variáveis</p>
      </div>
      {dre.despesasVariaveis.length === 0 && (
        <p className="px-5 pb-2 text-sm text-muted">Nenhuma despesa variável categorizada neste período.</p>
      )}
      {dre.despesasVariaveis.map((d) => (
        <DreLinha key={d.nome} label={d.nome} value={-d.valor} indent />
      ))}
      <DreLinha label="(-) Total despesas variáveis" value={-dre.totalVariaveis} variant="subtotal" />

      <DreLinha label="= Resultado líquido do período" value={dre.resultadoLiquido} variant="total" />
      <div className="px-5 pb-3 -mt-1">
        <p className="text-xs text-muted">
          Margem líquida: <span className="font-mono tabular">{dre.margem.toFixed(1)}%</span>
        </p>
      </div>

      <div className="px-5 py-3 bg-paper border-t-2 border-line space-y-1.5">
        <p className="text-xs font-medium text-muted uppercase tracking-wide mb-1">Ponto de equilíbrio</p>
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink">Margem de contribuição</span>
          <span className="font-mono tabular text-ink">{(dre.margemContribuicao * 100).toFixed(1)}%</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink">Receita mínima pra não ter prejuízo</span>
          <span className="font-mono tabular text-ink">
            {dre.pontoEquilibrio !== null ? formatBRL(dre.pontoEquilibrio) : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

export default async function DrePage({
  searchParams,
}: {
  searchParams: { mes?: string; ano?: string };
}) {
  const supabase = createClient();
  const now = new Date();

  let selectedMonthYear = now.getFullYear();
  let selectedMonthIndex = now.getMonth();
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

  const [categoriasRes, anoReceita, anoPagar, mesReceita, mesPagar] = await Promise.all([
    supabase.from("categorias").select("id, nome, tipo_custo"),
    supabase
      .from("contas_receber")
      .select("valor, categoria_id")
      .eq("status", "recebido")
      .gte("data_recebimento", yearStart)
      .lte("data_recebimento", yearEnd),
    supabase
      .from("contas_pagar")
      .select("valor, categoria_id")
      .eq("status", "pago")
      .gte("data_pagamento", yearStart)
      .lte("data_pagamento", yearEnd),
    supabase
      .from("contas_receber")
      .select("valor, categoria_id")
      .eq("status", "recebido")
      .gte("data_recebimento", mesStart)
      .lte("data_recebimento", mesEnd),
    supabase
      .from("contas_pagar")
      .select("valor, categoria_id")
      .eq("status", "pago")
      .gte("data_pagamento", mesStart)
      .lte("data_pagamento", mesEnd),
  ]);

  const categorias = (categoriasRes.data as Categoria[]) ?? [];
  const dreAno = montarDRE((anoReceita.data as ContaRow[]) ?? [], (anoPagar.data as ContaRow[]) ?? [], categorias);
  const dreMes = montarDRE((mesReceita.data as ContaRow[]) ?? [], (mesPagar.data as ContaRow[]) ?? [], categorias);

  return (
    <div>
      <div className="mb-6">
        <p className="font-display font-semibold text-xl text-ink">DRE</p>
        <p className="text-sm text-muted mt-0.5">
          Demonstração do Resultado — regime de caixa (o que foi recebido/pago de fato)
        </p>
      </div>

      <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
        <p className="text-xs font-medium text-muted uppercase tracking-wide">Ano de {selectedAno}</p>
        <YearFilter options={yearOptions()} selected={String(selectedAno)} />
      </div>
      <div className="mb-6">
        <DREBloco dre={dreAno} />
      </div>

      <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
        <p className="text-xs font-medium text-muted uppercase tracking-wide">
          {monthLabel(selectedMonthYear, selectedMonthIndex)}
        </p>
        <MonthFilter options={monthOptions(36)} selected={selectedMes} />
      </div>
      <DREBloco dre={dreMes} />
    </div>
  );
}
