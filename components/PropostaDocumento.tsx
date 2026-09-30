// Documento fiel ao modelo em PDF "Girando na Alta" — cores e layout são
// da identidade da marca do cliente/parceria, propositalmente diferentes
// do visual do ERP. Espaçamento calibrado pra caber numa página A4 (210x297mm).

const NAVY = "#0F1B2E";
const ORANGE = "#E8611E";

export const CRIADORES = ["Girando na Alta", "Lucas Feitoza", "Seliga Mídia"] as const;
export type Criador = (typeof CRIADORES)[number];

// artigo: usado em "O Girando na Alta transforma..." / "A Seliga Mídia transforma..." / "" pra nome próprio
// contraido: usado em "identidade do Girando na Alta" / "da Seliga Mídia" / "de Lucas Feitoza"
const GRAMATICA: Record<Criador, { artigo: string; contraido: string }> = {
  "Girando na Alta": { artigo: "O", contraido: "do" },
  "Lucas Feitoza": { artigo: "", contraido: "de" },
  "Seliga Mídia": { artigo: "A", contraido: "da" },
};

const AUDIENCIA = {
  instagramSeguidores: "+204 MIL",
  instagramVisualizacoes: "3,6 MILHÕES",
  tiktokSeguidores: "+430 MIL",
  youtubeInscritos: "+230 MIL",
  nota1: "82,4% das visualizações no Instagram vêm de não seguidores",
  nota2: "TikTok: 1,1 milhão de visualizações em 7 dias",
};

const FRENTES_PADRAO = [
  "Modelos e lançamentos",
  "Avaliações e comparativos",
  "Tecnologia e curiosidades",
  "Oportunidades comerciais",
];

const ESCOPO = [
  "Planejamento",
  "Pautas",
  "Desenvolvimento criativo",
  "Roteirização",
  "Gravação",
  "Apresentação",
  "Edição",
  "Finalização",
];

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export type PropostaOpcao = {
  titulo: string;
  valor: number;
  detalhe?: string | null;
};

export type PropostaDados = {
  empresa: string;
  criador?: Criador | string | null;
  meses: number;
  opcoes?: PropostaOpcao[] | null;
  // legado: propostas antigas (antes das opções múltiplas) só tinham isso
  quantidade_videos?: number | null;
  valor_unitario?: number | null;
  resumo?: string | null;
};

export default function PropostaDocumento({
  empresa,
  criador,
  meses,
  opcoes,
  quantidade_videos,
  valor_unitario,
  resumo,
}: PropostaDados) {
  // fallback pra proposta antiga, criada antes de existir a lista de opções
  const opcoesEfetivas: PropostaOpcao[] =
    opcoes && opcoes.length > 0
      ? opcoes
      : quantidade_videos && valor_unitario
      ? [
          {
            titulo: "Pacote completo",
            valor: quantidade_videos * valor_unitario,
            detalhe: `${formatBRL(valor_unitario)} por vídeo · ${quantidade_videos} vídeos`,
          },
        ]
      : [];
  const ano = new Date().getFullYear();
  const nomeEmpresa = empresa || "Sua Empresa";
  const nomeCriador: Criador = (criador as Criador) && GRAMATICA[criador as Criador] ? (criador as Criador) : "Girando na Alta";
  const { artigo, contraido } = GRAMATICA[nomeCriador];
  const isSeligaMidia = nomeCriador === "Seliga Mídia";

  return (
    <div
      id="proposta-print-area"
      className="bg-white"
      style={{ fontFamily: "Arial, Helvetica, sans-serif", colorAdjust: "exact", WebkitPrintColorAdjust: "exact" } as React.CSSProperties}
    >
      {/* Header */}
      <div style={{ backgroundColor: NAVY }} className="px-8 pt-6 pb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.png" alt="" className="w-7 h-7 rounded-full" />
            <span className="text-white font-bold text-base tracking-tight">
              seliga<span className="font-extrabold">MIDIA</span>
            </span>
          </div>
          <p className="text-white/60 text-[10px] tracking-wide uppercase">
            {nomeCriador} &nbsp;|&nbsp; Proposta Comercial &nbsp;|&nbsp; {ano}
          </p>
        </div>
        <div className="border-t border-white/15 pt-4">
          <p className="text-[10px] font-bold tracking-widest uppercase mb-1.5" style={{ color: ORANGE }}>
            {nomeEmpresa.toUpperCase()} + {nomeCriador.toUpperCase()}
          </p>
          <h1 className="text-white font-bold text-2xl md:text-[28px] leading-tight mb-2">
            Conteúdo que movimenta
            <br />
            marca, público e negócio.
          </h1>
          <p className="text-white/70 text-[13px]">
            Uma parceria de {meses} {meses === 1 ? "mês" : "meses"} para construir presença digital recorrente e
            relevante.
          </p>
        </div>
      </div>

      {/* Corpo branco: parceria / objetivo / frentes */}
      <div className="px-8 py-6">
        <div className="mb-6">
          <p className="text-[10px] font-bold tracking-widest uppercase mb-1.5" style={{ color: ORANGE }}>
            A Parceria
          </p>
          <p className="text-[13px] text-neutral-700 leading-snug mb-4">
            {artigo && `${artigo} `}
            <strong>{nomeCriador}</strong> transforma o universo automotivo em conteúdo leve, dinâmico e
            bem-humorado. A proposta conecta essa linguagem à {nomeEmpresa} para apresentar produtos e
            oportunidades comerciais com naturalidade, consistência e alto potencial de descoberta.
          </p>

          <p className="text-[10px] font-bold tracking-widest uppercase mb-1.5" style={{ color: ORANGE }}>
            Objetivo
          </p>
          <p className="text-[13px] text-neutral-700 leading-snug mb-4">
            Fortalecer a presença digital da {nomeEmpresa} com uma narrativa recorrente, capaz de informar,
            entreter e aproximar a marca de uma audiência que já consome conteúdo automotivo diariamente.
          </p>

          <p className="text-[10px] font-bold tracking-widest uppercase mb-1.5" style={{ color: ORANGE }}>
            {resumo ? "Resumo dos vídeos" : "Frentes de conteúdo"}
          </p>
          {resumo ? (
            <p className="text-[13px] text-neutral-700 leading-snug whitespace-pre-line">{resumo}</p>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {FRENTES_PADRAO.map((f) => (
                <p key={f} className="text-[13px] text-neutral-700 flex items-start gap-1.5">
                  <span style={{ color: ORANGE }}>•</span> {f}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Opções de investimento: cartões lado a lado (avulso / pacote / mensal / etc.) */}
        {opcoesEfetivas.length > 0 && (
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: ORANGE }}>
              {opcoesEfetivas.length > 1 ? "Opções de investimento" : "Investimento"}
            </p>
            <div className="flex flex-wrap gap-3">
              {opcoesEfetivas.map((o, i) => (
                <div key={i} className="bg-neutral-100 rounded-lg p-4 flex-1 min-w-[160px]">
                  <span
                    className="inline-block text-[9px] font-bold tracking-wide uppercase text-white px-2.5 py-1 rounded-full mb-2.5"
                    style={{ backgroundColor: ORANGE }}
                  >
                    {o.titulo}
                  </span>
                  <p className="text-2xl font-extrabold text-neutral-900 leading-tight">{formatBRL(o.valor)}</p>
                  {o.detalhe && <p className="text-xs text-neutral-500 mt-1">{o.detalhe}</p>}
                </div>
              ))}
            </div>
            <div style={{ backgroundColor: NAVY }} className="rounded-md py-2.5 px-3 text-center mt-3">
              <p className="text-white text-[10px] font-bold tracking-wide uppercase leading-snug">
                Planejamento, produção e entrega inclusos
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Audiência */}
      <div style={{ backgroundColor: NAVY }} className="px-8 py-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <p className="text-white text-[11px] font-bold tracking-wide uppercase">
            Audiência que já vive o universo automotivo
          </p>
          <p className="text-white/50 text-[10px] uppercase">Métricas do período analisado</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
          <div>
            <p className="text-white font-extrabold text-xl">{AUDIENCIA.instagramSeguidores}</p>
            <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: ORANGE }}>
              Instagram
            </p>
            <p className="text-white/60 text-[11px]">seguidores</p>
          </div>
          <div>
            <p className="text-white font-extrabold text-xl">{AUDIENCIA.instagramVisualizacoes}</p>
            <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: ORANGE }}>
              Instagram
            </p>
            <p className="text-white/60 text-[11px]">visualizações / 30 dias</p>
          </div>
          <div>
            <p className="text-white font-extrabold text-xl">{AUDIENCIA.tiktokSeguidores}</p>
            <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: ORANGE }}>
              TikTok
            </p>
            <p className="text-white/60 text-[11px]">seguidores</p>
          </div>
          <div>
            <p className="text-white font-extrabold text-xl">{AUDIENCIA.youtubeInscritos}</p>
            <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: ORANGE }}>
              YouTube
            </p>
            <p className="text-white/60 text-[11px]">inscritos</p>
          </div>
        </div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-0.5 text-white/50 text-[10px]">
          <p>{AUDIENCIA.nota1}</p>
          <p>{AUDIENCIA.nota2}</p>
        </div>
      </div>

      {/* Escopo de entrega */}
      <div className="px-8 py-5">
        <p className="text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: ORANGE }}>
          Escopo de entrega
        </p>
        <p className="text-[13px] text-neutral-700 flex flex-wrap gap-x-1.5 gap-y-1">
          {ESCOPO.map((e, i) => (
            <span key={e}>
              {e}
              {i < ESCOPO.length - 1 && <span style={{ color: ORANGE }}> &nbsp;•&nbsp; </span>}
            </span>
          ))}
        </p>
      </div>

      {/* Footer */}
      <div className="px-8 pb-6">
        <div className="border-t border-neutral-200 pt-3 flex flex-col md:flex-row md:items-end md:justify-between gap-2">
          <p className="text-[11px] text-neutral-500 max-w-md leading-snug">
            A linha editorial será definida em conjunto, alinhando os objetivos comerciais da {nomeEmpresa} à
            identidade {contraido} {nomeCriador}.
          </p>
          <div className="text-right">
            <p className="text-[11px] text-neutral-500">Proposta válida por 15 dias.</p>
            <p className="text-[11px] font-bold text-neutral-800">
              {isSeligaMidia ? "Seliga Mídia" : `${nomeCriador} / Seliga Mídia`}
            </p>
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: ORANGE }} className="h-2.5 w-full" />
    </div>
  );
}
