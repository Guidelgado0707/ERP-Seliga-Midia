// Documento fiel ao modelo em PDF "Girando na Alta" — cores e layout são
// da identidade da marca do cliente/parceria, propositalmente diferentes
// do visual do ERP.

const NAVY = "#0F1B2E";
const ORANGE = "#E8611E";

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

export type PropostaDados = {
  empresa: string;
  quantidade_videos: number;
  valor_unitario: number;
  resumo?: string | null;
};

export default function PropostaDocumento({ empresa, quantidade_videos, valor_unitario, resumo }: PropostaDados) {
  const total = quantidade_videos * valor_unitario;
  const meses = 3;
  const videosPorMes = Math.round(quantidade_videos / meses);
  const ano = new Date().getFullYear();
  const nomeEmpresa = empresa || "Sua Empresa";

  return (
    <div id="proposta-print-area" className="bg-white" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      {/* Header */}
      <div style={{ backgroundColor: NAVY }} className="px-10 pt-8 pb-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.png" alt="" className="w-8 h-8 rounded-full" />
            <span className="text-white font-bold text-lg tracking-tight">
              seliga<span className="font-extrabold">MIDIA</span>
            </span>
          </div>
          <p className="text-white/60 text-[11px] tracking-wide uppercase">
            Girando na Alta &nbsp;|&nbsp; Proposta Comercial &nbsp;|&nbsp; {ano}
          </p>
        </div>
        <div className="border-t border-white/15 pt-6">
          <p className="text-[11px] font-bold tracking-widest uppercase mb-3" style={{ color: ORANGE }}>
            {nomeEmpresa.toUpperCase()} + GIRANDO NA ALTA
          </p>
          <h1 className="text-white font-bold text-3xl md:text-4xl leading-tight mb-3">
            Conteúdo que movimenta
            <br />
            marca, público e negócio.
          </h1>
          <p className="text-white/70 text-sm">
            Uma parceria de {meses} meses para construir presença digital recorrente e relevante.
          </p>
        </div>
      </div>

      {/* Corpo branco: parceria / objetivo / frentes  +  card de pacote */}
      <div className="px-10 py-10 grid grid-cols-1 md:grid-cols-2 gap-10">
        <div>
          <p className="text-[11px] font-bold tracking-widest uppercase mb-2" style={{ color: ORANGE }}>
            A Parceria
          </p>
          <p className="text-sm text-neutral-700 leading-relaxed mb-6">
            O <strong>Girando na Alta</strong> transforma o universo automotivo em conteúdo leve, dinâmico e
            bem-humorado. A proposta conecta essa linguagem à {nomeEmpresa} para apresentar produtos e
            oportunidades comerciais com naturalidade, consistência e alto potencial de descoberta.
          </p>

          <p className="text-[11px] font-bold tracking-widest uppercase mb-2" style={{ color: ORANGE }}>
            Objetivo
          </p>
          <p className="text-sm text-neutral-700 leading-relaxed mb-6">
            Fortalecer a presença digital da {nomeEmpresa} com uma narrativa recorrente, capaz de informar,
            entreter e aproximar a marca de uma audiência que já consome conteúdo automotivo diariamente.
          </p>

          <p className="text-[11px] font-bold tracking-widest uppercase mb-2" style={{ color: ORANGE }}>
            {resumo ? "Resumo dos vídeos" : "Frentes de conteúdo"}
          </p>
          {resumo ? (
            <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-line">{resumo}</p>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {FRENTES_PADRAO.map((f) => (
                <p key={f} className="text-sm text-neutral-700 flex items-start gap-1.5">
                  <span style={{ color: ORANGE }}>•</span> {f}
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="bg-neutral-100 rounded-lg p-6">
          <span
            className="inline-block text-[11px] font-bold tracking-wide uppercase text-white px-3 py-1.5 rounded-full mb-5"
            style={{ backgroundColor: ORANGE }}
          >
            Pacote completo
          </span>
          <p className="text-4xl font-extrabold text-neutral-900 mb-1">{formatBRL(total)}</p>
          <p className="text-xs text-neutral-500 mb-5">
            investimento total &nbsp;|&nbsp; {formatBRL(valor_unitario)} por vídeo
          </p>
          <div className="border-t border-neutral-300 pt-5 grid grid-cols-3 gap-2 mb-5">
            <div>
              <p className="text-2xl font-extrabold" style={{ color: ORANGE }}>
                {String(meses).padStart(2, "0")}
              </p>
              <p className="text-[10px] font-bold uppercase text-neutral-500 tracking-wide">Meses</p>
            </div>
            <div>
              <p className="text-2xl font-extrabold" style={{ color: ORANGE }}>
                {String(quantidade_videos).padStart(2, "0")}
              </p>
              <p className="text-[10px] font-bold uppercase text-neutral-500 tracking-wide">Vídeos</p>
            </div>
            <div>
              <p className="text-2xl font-extrabold" style={{ color: ORANGE }}>
                {String(videosPorMes).padStart(2, "0")}
              </p>
              <p className="text-[10px] font-bold uppercase text-neutral-500 tracking-wide">Vídeos / mês</p>
            </div>
          </div>
          <div style={{ backgroundColor: NAVY }} className="rounded-md py-3 px-3 text-center">
            <p className="text-white text-[11px] font-bold tracking-wide uppercase">
              Planejamento, produção e entrega inclusos
            </p>
          </div>
        </div>
      </div>

      {/* Audiência */}
      <div style={{ backgroundColor: NAVY }} className="px-10 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <p className="text-white text-xs font-bold tracking-wide uppercase">
            Audiência que já vive o universo automotivo
          </p>
          <p className="text-white/50 text-[11px] uppercase">Métricas do período analisado</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-5">
          <div>
            <p className="text-white font-extrabold text-2xl">{AUDIENCIA.instagramSeguidores}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: ORANGE }}>
              Instagram
            </p>
            <p className="text-white/60 text-xs">seguidores</p>
          </div>
          <div>
            <p className="text-white font-extrabold text-2xl">{AUDIENCIA.instagramVisualizacoes}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: ORANGE }}>
              Instagram
            </p>
            <p className="text-white/60 text-xs">visualizações / 30 dias</p>
          </div>
          <div>
            <p className="text-white font-extrabold text-2xl">{AUDIENCIA.tiktokSeguidores}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: ORANGE }}>
              TikTok
            </p>
            <p className="text-white/60 text-xs">seguidores</p>
          </div>
          <div>
            <p className="text-white font-extrabold text-2xl">{AUDIENCIA.youtubeInscritos}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: ORANGE }}>
              YouTube
            </p>
            <p className="text-white/60 text-xs">inscritos</p>
          </div>
        </div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 text-white/50 text-[11px]">
          <p>{AUDIENCIA.nota1}</p>
          <p>{AUDIENCIA.nota2}</p>
        </div>
      </div>

      {/* Escopo de entrega */}
      <div className="px-10 py-8">
        <p className="text-[11px] font-bold tracking-widest uppercase mb-3" style={{ color: ORANGE }}>
          Escopo de entrega
        </p>
        <p className="text-sm text-neutral-700 flex flex-wrap gap-x-1.5 gap-y-1">
          {ESCOPO.map((e, i) => (
            <span key={e}>
              {e}
              {i < ESCOPO.length - 1 && <span style={{ color: ORANGE }}> &nbsp;•&nbsp; </span>}
            </span>
          ))}
        </p>
      </div>

      {/* Footer */}
      <div className="px-10 pb-10">
        <div className="border-t border-neutral-200 pt-5 flex flex-col md:flex-row md:items-end md:justify-between gap-2">
          <p className="text-xs text-neutral-500 max-w-md leading-relaxed">
            A linha editorial será definida em conjunto, alinhando os objetivos comerciais da {nomeEmpresa} à
            identidade do Girando na Alta.
          </p>
          <div className="text-right">
            <p className="text-xs text-neutral-500">Proposta válida por 15 dias.</p>
            <p className="text-xs font-bold text-neutral-800">Girando na Alta / Seligamidia</p>
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: ORANGE }} className="h-3 w-full" />
    </div>
  );
}
