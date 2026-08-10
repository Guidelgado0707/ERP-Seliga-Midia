import { createClient } from "@/lib/supabaseServer";
import MonthFilter from "@/components/MonthFilter";
import YearFilter from "@/components/YearFilter";
import { DreLinha } from "@/components/DreLinha";
import { monthRange, monthLabel, monthOptions, yearOptions } from "@/lib/dateUtils";

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type ContaPagarRow = { valor: number; categoria_id: string | null };
type Categoria = { id: string; nome: string };

function montarDRE(receitaRows: { valor: number }[], pagarRows: ContaPagarRow[], categorias: Categoria[]) {
  const nomeMap = new Map(categorias.map((c) => [c.id, c.nome]));
  const receitaBruta = receitaRows.reduce((acc, r) => acc + Number(r.valor), 0);

  const porCategoria = new Map<string, number>();
  for (const r of pagarRows) {
    const nome = r.categoria_id ? nomeMap.get(r.categoria_id) ?? "Sem categoria" : "Sem categoria";
    porCategoria.set(nome, (porCategoria.get(nome) ?? 0) + Number(r.valor));
  }

  const impostos = porCategoria.get("Impostos") ?? 0;
  const despesas = Array.from(porCategoria, ([nome, valor]) => ({ nome, valor }))
    .filter((d) => d.nome !== "Impostos")
    .sort((a, b) => b.valor - a.valor);

  const receitaLiquida = receitaBruta - impostos;
  const totalDespesas = despesas.reduce((acc, d) => acc + d.valor, 0);
  const resultadoLiquido = receitaLiquida - totalDespesas;
  const margem = receitaBruta > 0 ? (resultadoLiquido / receitaBruta) * 100 : 0;

  return { receitaBruta, impostos, receitaLiquida, despesas, totalDespesas, resultadoLiquido, margem };
}

function DREBloco({ dre }: { dre: ReturnType<typeof montarDRE> }) {
  return (
    <div className="bg-white rounded-md shadow-sm overflow-hidden">
      <DreLinha label="Receita bruta" value={dre.receitaBruta} />
      <DreLinha label="(-) Impostos" value={-dre.impostos} indent />
      <DreLinha label="= Receita líquida" value={dre.receitaLiquida} variant="subtotal" />

      <div className="px-5 pt-3 pb-1">
        <p className="text-xs font-medium text-muted uppercase tracking-wide">Despesas operacionais</p>
      </div>
      {dre.despesas.length === 0 && (
        <p className="px-5 pb-2 text-sm text-muted">Nenhuma despesa categorizada neste período.</p>
      )}
      {dre.despesas.map((d) => (
        <DreLinha key={d.nome} label={d.nome} value={-d.valor} indent />
      ))}
      <DreLinha label="(-) Total despesas operacionais" value={-dre.totalDespesas} variant="subtotal" />

      <DreLinha label="= Resultado líquido do período" value={dre.resultadoLiquido} variant="total" />
      <div className="px-5 pb-3 -mt-1">
        <p className="text-xs text-muted">
          Margem líquida: <span className="font-mono tabular">{dre.margem.toFixed(1)}%</span>
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
    supabase.from("categorias").select("id, nome"),
    supabase.from("contas_receber").select("valor").eq("status", "recebido").gte("data_recebimento", yearStart).lte("data_recebimento", yearEnd),
    supabase.from("contas_pagar").select("valor, categoria_id").eq("status", "pago").gte("data_pagamento", yearStart).lte("data_pagamento", yearEnd),
    supabase.from("contas_receber").select("valor").eq("status", "recebido").gte("data_recebimento", mesStart).lte("data_recebimento", mesEnd),
    supabase.from("contas_pagar").select("valor, categoria_id").eq("status", "pago").gte("data_pagamento", mesStart).lte("data_pagamento", mesEnd),
  ]);

  const categorias = categoriasRes.data ?? [];
  const dreAno = montarDRE(anoReceita.data ?? [], (anoPagar.data as ContaPagarRow[]) ?? [], categorias);
  const dreMes = montarDRE(mesReceita.data ?? [], (mesPagar.data as ContaPagarRow[]) ?? [], categorias);

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
