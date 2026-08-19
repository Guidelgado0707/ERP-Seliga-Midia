"use client";

import { useState, useRef } from "react";

// Paleta categórica validada (slots 1-3 da skill de dataviz — passam CVD all-pairs)
const CORES = ["#2a78d6", "#eb6834", "#1baf7a"]; // azul, laranja, aqua
const MUTED = "#5B6460";
const LINE = "#DDE2DE";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatCompact(v: number) {
  if (v >= 1000) return `${Math.round(v / 1000)} mil`;
  return String(Math.round(v));
}

export type SerieAno = {
  ano: number;
  valores: (number | null)[]; // 12 posições, jan..dez — null = sem dado (mês futuro/sem lançamento)
};

export default function YearComparativoChart({
  titulo,
  series,
}: {
  titulo: string;
  series: SerieAno[];
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const w = 720;
  const h = 320;
  const padL = 56;
  const padR = 46;
  const padT = 16;
  const padB = 28;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const anoMaisRecente = Math.max(...series.map((s) => s.ano));
  const todosValores = series.flatMap((s) => s.valores).filter((v): v is number => v !== null);
  const max = Math.max(...todosValores, 1);
  const niceMax = Math.ceil(max / 20000) * 20000 || 20000;
  const ySteps = 4;

  function x(i: number) {
    return padL + (i / 11) * plotW;
  }
  function y(v: number) {
    return padT + plotH - (v / niceMax) * plotH;
  }

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((e.clientX - rect.left) / rect.width) * w;
    const idx = Math.round(((px - padL) / plotW) * 11);
    if (idx >= 0 && idx <= 11) setHoverIdx(idx);
  }

  return (
    <div className="bg-white rounded-md shadow-sm p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-sm font-medium text-ink">{titulo}</p>
        <div className="flex items-center gap-4">
          {series.map((s, i) => (
            <span key={s.ano} className="flex items-center gap-1.5 text-xs text-muted">
              <span className="inline-block w-4 h-0.5 rounded-full" style={{ backgroundColor: CORES[i % CORES.length] }} />
              {s.ano}
            </span>
          ))}
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-auto"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {/* gridlines */}
        {Array.from({ length: ySteps + 1 }, (_, i) => {
          const v = (niceMax / ySteps) * i;
          const gy = y(v);
          return (
            <g key={i}>
              <line x1={padL} y1={gy} x2={w - padR} y2={gy} stroke={LINE} strokeWidth={1} />
              <text x={padL - 8} y={gy + 3} textAnchor="end" fontSize="10" fill={MUTED}>
                {formatCompact(v)}
              </text>
            </g>
          );
        })}

        {/* meses (X) */}
        {MESES.map((m, i) => (
          <text key={m} x={x(i)} y={h - 8} textAnchor="middle" fontSize="10" fill={MUTED}>
            {m}
          </text>
        ))}

        {/* crosshair */}
        {hoverIdx !== null && (
          <line x1={x(hoverIdx)} y1={padT} x2={x(hoverIdx)} y2={padT + plotH} stroke={MUTED} strokeWidth={1} strokeDasharray="3 3" />
        )}

        {/* linhas por ano */}
        {series.map((s, si) => {
          const cor = CORES[si % CORES.length];
          const pontos = s.valores
            .map((v, i) => (v !== null ? { i, v } : null))
            .filter((p): p is { i: number; v: number } => p !== null);

          // quebra o traço em segmentos contínuos (não liga por cima de meses sem dado)
          const segmentos: { i: number; v: number }[][] = [];
          let atual: { i: number; v: number }[] = [];
          for (let i = 0; i < 12; i++) {
            const v = s.valores[i];
            if (v !== null) {
              atual.push({ i, v });
            } else if (atual.length) {
              segmentos.push(atual);
              atual = [];
            }
          }
          if (atual.length) segmentos.push(atual);

          const ultimo = pontos[pontos.length - 1];

          return (
            <g key={s.ano}>
              {segmentos.map((seg, gi) => (
                <path
                  key={gi}
                  d={seg.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.i)} ${y(p.v)}`).join(" ")}
                  fill="none"
                  stroke={cor}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
              {pontos.map((p) => (
                <circle
                  key={p.i}
                  cx={x(p.i)}
                  cy={y(p.v)}
                  r={hoverIdx === p.i ? 5 : 4}
                  fill={cor}
                  stroke="white"
                  strokeWidth={2}
                />
              ))}
              {/* só o ano mais recente leva rótulo direto — os anos completos (até dez)
                  disputariam o mesmo canto e colidiriam; ficam no hover + legenda */}
              {ultimo && s.ano === anoMaisRecente && (
                <text
                  x={Math.min(x(ultimo.i) + 6, w - 4)}
                  y={y(ultimo.v) + 4}
                  textAnchor={ultimo.i === 11 ? "end" : "start"}
                  fontSize="10.5"
                  fontWeight={600}
                  fill={cor}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {formatCompact(ultimo.v)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {hoverIdx !== null && (
        <div className="border-t border-line pt-2.5 mt-1">
          <p className="text-xs font-medium text-ink mb-1">{MESES[hoverIdx]}</p>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {series.map((s, i) => {
              const v = s.valores[hoverIdx];
              return (
                <span key={s.ano} className="text-xs flex items-center gap-1.5">
                  <span className="inline-block w-3 h-0.5 rounded-full" style={{ backgroundColor: CORES[i % CORES.length] }} />
                  <span className="text-muted">{s.ano}:</span>
                  <span className="font-mono tabular font-medium text-ink">{v !== null ? formatBRL(v) : "—"}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
