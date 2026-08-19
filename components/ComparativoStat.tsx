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

// mini sparkline: pontos passados em cinza, ponto/segmento atual na cor de destaque
function Sparkline({ pontos, accent }: { pontos: number[]; accent: string }) {
  if (pontos.length < 2) return null;
  const w = 200;
  const h = 40;
  const pad = 6;
  const max = Math.max(...pontos, 1);
  const min = Math.min(...pontos, 0);
  const range = max - min || 1;
  const stepX = (w - pad * 2) / (pontos.length - 1);
  const coords = pontos.map((v, i) => {
    const x = pad + i * stepX;
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return [x, y] as const;
  });
  const pathPast = coords
    .slice(0, -1)
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`)
    .join(" ");
  const lastSegment = `M ${coords[coords.length - 2][0]} ${coords[coords.length - 2][1]} L ${coords[coords.length - 1][0]} ${coords[coords.length - 1][1]}`;
  const [lastX, lastY] = coords[coords.length - 1];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-10" preserveAspectRatio="none">
      <path d={pathPast} fill="none" stroke={MUTED} strokeOpacity={0.35} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <path d={lastSegment} fill="none" stroke={accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r={4} fill={accent} stroke="white" strokeWidth={2} />
    </svg>
  );
}

export type ComparativoStatProps = {
  label: string;
  valorAtual: number;
  deltaMesAnterior: number | null;
  deltaAnoPassado: number | null;
  labelAnoPassado: string;
  tendencia: number[]; // últimos N meses, incluindo o atual (último item)
  upIsGood: boolean;
};

export default function ComparativoStat({
  label,
  valorAtual,
  deltaMesAnterior,
  deltaAnoPassado,
  labelAnoPassado,
  tendencia,
  upIsGood,
}: ComparativoStatProps) {
  const accent = upIsGood ? LEDGER : CRIMSON;
  return (
    <div className="bg-white rounded-md shadow-sm p-5">
      <p className="text-xs font-medium text-muted uppercase tracking-wide mb-1">{label}</p>
      <p className="font-mono tabular text-2xl font-semibold text-ink mb-2">{formatBRL(valorAtual)}</p>
      <div className="flex items-center gap-4 mb-3 flex-wrap">
        <DeltaBadge valor={deltaMesAnterior} comparativo="vs mês anterior" upIsGood={upIsGood} />
        <DeltaBadge valor={deltaAnoPassado} comparativo={`vs ${labelAnoPassado}`} upIsGood={upIsGood} />
      </div>
      <Sparkline pontos={tendencia} accent={accent} />
    </div>
  );
}
