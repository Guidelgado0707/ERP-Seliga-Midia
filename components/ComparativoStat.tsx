"use client";

const LEDGER = "#0F6B5C";
const CRIMSON = "#B3261E";
const MUTED = "#5B6460";

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPct(v: number) {
  const sinal = v > 0 ? "+" : "";
  return `${sinal}${v.toFixed(0)}%`;
}

// upIsGood = true pro Faturamento (subir é bom), false pro Custo (subir é ruim)
function corDelta(v: number, upIsGood: boolean) {
  if (v === 0) return MUTED;
  const subiu = v > 0;
  const bom = subiu === upIsGood;
  return bom ? LEDGER : CRIMSON;
}

function DeltaBadge({ valor, comparativo, upIsGood }: { valor: number | null; comparativo: string; upIsGood: boolean }) {
  if (valor === null) {
    return (
      <span className="text-xs text-muted">
        {comparativo}: <span className="text-muted">sem dado</span>
      </span>
    );
  }
  const cor = corDelta(valor, upIsGood);
  const seta = valor > 0 ? "▲" : valor < 0 ? "▼" : "•";
  return (
    <span className="text-xs">
      <span className="text-muted">{comparativo}: </span>
      <span className="font-mono tabular font-medium" style={{ color: cor }}>
        {seta} {formatPct(valor)}
      </span>
    </span>
  );
}

export type ComparativoStatProps = {
  label: string;
  valorAtual: number;
  deltaMesAnterior: number | null;
  deltaAnoPassado: number | null;
  labelAnoPassado: string;
  upIsGood: boolean;
};

export default function ComparativoStat({
  label,
  valorAtual,
  deltaMesAnterior,
  deltaAnoPassado,
  labelAnoPassado,
  upIsGood,
}: ComparativoStatProps) {
  return (
    <div className="bg-white rounded-md shadow-sm p-5">
      <p className="text-xs font-medium text-muted uppercase tracking-wide mb-1">{label}</p>
      <p className="font-mono tabular text-2xl font-semibold text-ink mb-2">{formatBRL(valorAtual)}</p>
      <div className="flex items-center gap-4 flex-wrap">
        <DeltaBadge valor={deltaMesAnterior} comparativo="vs mês anterior" upIsGood={upIsGood} />
        <DeltaBadge valor={deltaAnoPassado} comparativo={`vs ${labelAnoPassado}`} upIsGood={upIsGood} />
      </div>
    </div>
  );
}
