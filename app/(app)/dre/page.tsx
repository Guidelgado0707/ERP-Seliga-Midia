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

  // Lucro Operacional (EBIT): resultado das operações, antes de resultado financeiro.
  // Como o sistema não rastreia receitas/despesas financeiras, e o regime é Simples
  // Nacional (sem IR/CSLL apurado à parte — já embutido no imposto sobre a receita),
  // Lucro Operacional = Lucro Líquido do período nesta DRE.
  const lucroOperacional = receitaLiquida - totalDespesas;
  const lucroLiquido = lucroOperacional;
  const margemOperacional = receitaLiquida > 0 ? (lucroOperacional / receitaLiquida) * 100 : 0;
  const margemLiquida = receitaLiquida > 0 ? (lucroLiquido / receitaLiquida) * 100 : 0;

  // Margem de contribuição (custeio variável): impostos sobre a receita são
  // proporcionais ao faturamento, então contam como variáveis aqui — mesmo já
  // aparecendo deduzidos antes na DRE. Base = Receita Bruta (padrão contábil).
  const custosVariaveisTotal = impostos + totalVariaveis;
  const margemContribuicaoValor = receitaBruta - custosVariaveisTotal;
  const indiceMC = receitaBruta > 0 ? margemContribuicaoValor / receitaBruta : 0;
  const pontoEquilibrio = indiceMC > 0 ? totalFixas / indiceMC : null;

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
    lucroOperacional,
    lucroLiquido,
    margemOperacional,
    margemLiquida,
    margemContribuicaoValor,
    indiceMC,
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

      <DreLinha label="= Lucro operacional (EBIT)" value={dre.lucroOperacional} variant="total" />
      <div className="px-5 pb-2 -mt-1">
        <p className="text-xs text-muted">
          Margem operacional: <span className="font-mono tabular">{dre.margemOperacional.toFixed(1)}%</span>
        </p>
      </div>

      <DreLinha label="= Lucro líquido do período" value={dre.lucroLiquido} variant="total" />
      <div className="px-5 pb-1 -mt-1">
        <p className="text-xs text-muted">
          Margem líquida: <span className="font-mono tabular">{dre.margemLiquida.toFixed(1)}%</span>
        </p>
      </div>
      <p className="px-5 pb-3 text-[11px] text-muted leading-relaxed">
        No Simples Nacional o imposto sobre o lucro já vem embutido no imposto sobre a receita, e o sistema não
        rastreia receitas/despesas financeiras — por isso Lucro Operacional = Lucro Líquido aqui.
      </p>

      <div className="px-5 py-3 bg-paper border-t-2 border-line space-y-1.5">
        <p className="text-xs font-medium text-muted uppercase tracking-wide mb-1">
          Ponto de equilíbrio (custeio variável)
        </p>
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink">Margem de contribuição (R$)</span>
          <span className="font-mono tabular text-ink">{formatBRL(dre.margemContribuicaoValor)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink">Índice de margem de contribuição</span>
          <span className="font-mono tabular text-ink">{(dre.indiceMC * 100).toFixed(1)}%</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink">Ponto de equilíbrio contábil</span>
          <span className="font-mono tabular text-ink">
            {dre.pontoEquilibrio !== null ? formatBRL(dre.pontoEquilibrio) : "—"}
          </span>
        </div>
        <p className="text-[11px] text-muted leading-relaxed pt-1">
          Receita bruta mínima pra cobrir custos fixos e variáveis (impostos inclusos, por serem proporcionais
          à receita) sem lucro nem prejuízo.
        </p>
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
      .eq("origem", "seliga_midia")
      .eq("reembolso", false)
      .gte("data_recebimento", yearStart)
      .lte("data_recebimento", yearEnd),
    supabase
      .from("contas_pagar")
      .select("valor, categoria_id")
      .eq("status", "pago")
      .eq("origem", "seliga_midia")
      .gte("data_pagamento", yearStart)
      .lte("data_pagamento", yearEnd),
    supabase
      .from("contas_receber")
      .select("valor, categoria_id")
      .eq("status", "recebido")
      .eq("origem", "seliga_midia")
      .eq("reembolso", false)
      .gte("data_recebimento", mesStart)
      .lte("data_recebimento", mesEnd),
    supabase
      .from("contas_pagar")
      .select("valor, categoria_id")
      .eq("status", "pago")
      .eq("origem", "seliga_midia")
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
