// Reproduz fielmente o modelo de contrato de parceria comercial pontual usado
// pela Seliga Mídia. Visual propositalmente formal/neutro (documento jurídico),
// diferente do resto do ERP.

export const CRIADORES = [
  { id: "pedro", nome: "Pedro Augusto", handle: "@girandonaalta" },
  { id: "andre", nome: "André Feitoza", handle: "@seligamidia" },
  { id: "lucas", nome: "Lucas Feitoza", handle: "@lucasfeitoza_" },
] as const;
export type CriadorId = (typeof CRIADORES)[number]["id"];

const CONTRATADA = {
  razaoSocial: "Seliga Mídia LTDA",
  cnpj: "26.825.330/0001-00",
  endereco: "Av. Francisco Simões Barboza, 558, Sala 801 — Boa Viagem, Recife/PE — CEP 51021-060",
  representante: "André Augusto Feitoza Santos",
  email: "seliganos15@gmail.com",
  banco: "C6 Bank — Cód. 336 / Ag. 0001 / Conta: 23009172-5 / PIX: 26.825.330/0001-00",
};

const BRIEFING_DIAS = 5;
const PRAZO_ENTREGA_DIAS = 7;

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const NUMEROS_EXTENSO: Record<number, string> = {
  1: "um", 2: "dois", 3: "três", 4: "quatro", 5: "cinco",
  6: "seis", 7: "sete", 8: "oito", 9: "nove", 10: "dez",
};

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dataExtenso(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} de ${MESES[m - 1]} de ${y}`;
}

function videoLabel(n: number) {
  const extenso = NUMEROS_EXTENSO[n];
  const palavra = n === 1 ? "vídeo" : "vídeos";
  return extenso ? `${n} (${extenso}) ${palavra}` : `${n} ${palavra}`;
}

function diasLabel(n: number) {
  const extenso = NUMEROS_EXTENSO[n];
  return extenso ? `${n} (${extenso}) dias` : `${n} dias`;
}

export type ContratoDados = {
  contratante_razao_social: string;
  contratante_cnpj: string;
  contratante_endereco: string;
  contratante_representante: string;
  contratante_email: string;
  criador: string;
  quantidade_videos: number;
  valor_por_video: number;
  data_contrato: string;
  testemunha1_nome: string;
  testemunha1_cpf: string;
  testemunha2_nome?: string | null;
  testemunha2_cpf?: string | null;
};

function Th({ children }: { children: React.ReactNode }) {
  return (
    <td className="border border-neutral-400 bg-neutral-100 px-2.5 py-1.5 text-[11px] font-bold w-[38%] align-top">
      {children}
    </td>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="border border-neutral-400 px-2.5 py-1.5 text-[11px] align-top">{children}</td>;
}
function ClauseTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] font-bold mt-4 mb-1.5">{children}</p>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[11.5px] leading-relaxed mb-2">{children}</p>;
}
function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="text-[11.5px] leading-relaxed mb-1.5 ml-4" style={{ listStyleType: "disc" }}>
      {children}
    </li>
  );
}

export default function ContratoDocumento({
  contratante_razao_social,
  contratante_cnpj,
  contratante_endereco,
  contratante_representante,
  contratante_email,
  criador,
  quantidade_videos,
  valor_por_video,
  data_contrato,
  testemunha1_nome,
  testemunha1_cpf,
  testemunha2_nome,
  testemunha2_cpf,
}: ContratoDados) {
  const n = Number(quantidade_videos) || 1;
  const criadorInfo = CRIADORES.find((c) => c.id === criador) ?? CRIADORES[0];
  const total = n * Number(valor_por_video);
  const plural = n > 1;

  return (
    <div
      id="contrato-print-area"
      className="bg-white text-neutral-900 px-10 py-8 mx-auto"
      style={{ fontFamily: "Calibri, Arial, Helvetica, sans-serif", maxWidth: "210mm" }}
    >
      <h1 className="text-center text-[16px] font-bold mb-1">CONTRATO DE PARCERIA COMERCIAL</h1>
      <p className="text-center text-[13px] font-bold mb-6">
        Contrato Pontual — {contratante_razao_social} ({plural ? `${n} Vídeos` : "Vídeo Único"})
      </p>

      <p className="text-[12px] font-bold mb-2">PARTES DO CONTRATO</p>

      <p className="text-[11.5px] font-bold mb-1">CONTRATANTE</p>
      <table className="w-full border-collapse mb-4">
        <tbody>
          <tr><Th>Razão Social</Th><Td>{contratante_razao_social}</Td></tr>
          <tr><Th>CNPJ</Th><Td>{contratante_cnpj}</Td></tr>
          <tr><Th>Endereço</Th><Td>{contratante_endereco}</Td></tr>
          <tr><Th>Representante Legal</Th><Td>{contratante_representante}</Td></tr>
          <tr><Th>E-mail</Th><Td>{contratante_email}</Td></tr>
        </tbody>
      </table>

      <p className="text-[11.5px] font-bold mb-1">CONTRATADA</p>
      <table className="w-full border-collapse mb-4">
        <tbody>
          <tr><Th>Razão Social</Th><Td>{CONTRATADA.razaoSocial}</Td></tr>
          <tr><Th>CNPJ</Th><Td>{CONTRATADA.cnpj}</Td></tr>
          <tr><Th>Endereço</Th><Td>{CONTRATADA.endereco}</Td></tr>
          <tr><Th>Representante Legal</Th><Td>{CONTRATADA.representante}</Td></tr>
          <tr><Th>E-mail</Th><Td>{CONTRATADA.email}</Td></tr>
          <tr><Th>Criador / Perfil Vinculado</Th><Td>{criadorInfo.nome} ({criadorInfo.handle})</Td></tr>
        </tbody>
      </table>

      <ClauseTitle>Cláusula 1ª — Do Objeto</ClauseTitle>
      <P>
        O presente contrato tem por objeto a prestação de serviço de criação e publicação de conteúdo digital
        patrocinado pela Contratante ({contratante_razao_social}), de forma pontual, consistindo na produção de{" "}
        {videoLabel(n)}, conforme condições descritas neste instrumento.
      </P>
      <P>
        A Contratada compromete-se a realizar a produção e publicação do conteúdo nas plataformas digitais do
        criador {criadorInfo.nome} ({criadorInfo.handle}), integrando a marca da Contratante de forma natural e
        alinhada à identidade do criador, bem como a ceder o direito de uso de sua imagem, voz e nome, associados a{" "}
        {plural ? "estes vídeos" : "este vídeo"}, nos termos da Cláusula 6ª.
      </P>

      <ClauseTitle>Cláusula 2ª — Das Entregas</ClauseTitle>
      <ul>
        <Li>
          {videoLabel(n)} no formato Reels/TikTok, com integração natural à marca da Contratante, a ser{" "}
          {plural ? "entregues" : "entregue"} no prazo de {diasLabel(PRAZO_ENTREGA_DIAS)} corridos a contar da
          assinatura deste contrato, conforme calendário editorial a ser alinhado entre as partes;
        </Li>
        <Li>
          A produção {plural ? "dos vídeos" : "do vídeo"} será realizada de forma colaborativa, envolvendo a
          Contratada ({criadorInfo.nome}) e a equipe de social mídia da Contratante, com roteiro, gravação e edição
          alinhados conforme fluxo de trabalho definido entre as partes;
        </Li>
        <Li>
          O conteúdo produzido será entregue à Contratante para uso prioritário em seus próprios canais e campanhas
          de tráfego pago. {plural ? "Os vídeos poderão" : "O vídeo poderá"} ser {plural ? "publicados" : "publicado"}{" "}
          em colaboração (post em colab) entre o perfil do criador ({criadorInfo.handle}) e o perfil oficial da
          Contratante, mediante alinhamento prévio entre as partes quanto à data e formato da publicação;
        </Li>
        <Li>
          Narrativa de parceria: a marca será apresentada como patrocinadora do conteúdo, integrada de forma
          orgânica, não como inserção publicitária isolada.
        </Li>
      </ul>

      <ClauseTitle>Cláusula 3ª — Da Aprovação de Conteúdo</ClauseTitle>
      <P>
        Todo conteúdo produzido no âmbito deste contrato deverá ser previamente submetido à Contratante para análise
        e aprovação antes de sua entrega final ou publicação, quando aplicável.
      </P>
      <P>
        A Contratante terá o prazo de até 2 (dois) dias úteis para aprovar o material ou solicitar ajustes que
        estejam relacionados ao briefing, à identidade da marca ou às diretrizes previamente alinhadas entre as
        partes.
      </P>
      <P>
        A Contratada realizará, sem custo adicional, até 2 (duas) rodadas de ajustes no conteúdo, desde que as
        solicitações não representem alteração substancial do conceito originalmente aprovado.
      </P>
      <P>Após a aprovação da Contratante, o conteúdo será considerado validado para utilização e/ou publicação.</P>

      <ClauseTitle>Cláusula 4ª — Do Valor e Forma de Pagamento</ClauseTitle>
      <table className="w-full border-collapse mb-2">
        <tbody>
          <tr><Th>Valor do vídeo</Th><Td>{formatBRL(Number(valor_por_video))}</Td></tr>
          <tr><Th>Quantidade de vídeos</Th><Td>{n}</Td></tr>
          <tr><Th>Valor Total</Th><Td>{formatBRL(total)}</Td></tr>
          <tr><Th>Forma de Pagamento</Th><Td>PIX / TED / Transferência Bancária</Td></tr>
          <tr><Th>Dados Bancários</Th><Td>{CONTRATADA.banco}</Td></tr>
        </tbody>
      </table>
      <P>
        O valor total do contrato será pago em parcela única, em até 10 (dez) dias a contar do envio da nota fiscal
        pela Contratada, observado o disposto na Cláusula 4.1ª.
      </P>
      <P>
        O não pagamento no prazo acordado suspende as obrigações de entrega da Contratada até regularização, sem
        geração de multa para a Contratada, sem prejuízo do disposto na Cláusula 4.1ª.
      </P>

      <ClauseTitle>Cláusula 4.1ª — Da Emissão de Notas Fiscais e Mora</ClauseTitle>
      <P>
        O pagamento previsto acima será efetuado mediante prévia emissão de nota fiscal (quando aplicável), que
        deverá ser encaminhada com 5 (cinco) dias de antecedência do vencimento para a Contratante. Em caso de
        atraso no pagamento devido, haverá a incidência de multa compensatória equivalente a 1% (um por cento) do
        valor em atraso, bem como juros de mora de 1% (um por cento) ao mês, calculados pro rata até a data do
        efetivo pagamento. Os pagamentos serão realizados na conta corrente de titularidade da Contratada, devendo
        os dados bancários constar no corpo da Nota Fiscal ou recibo.
      </P>

      <ClauseTitle>Cláusula 4.2ª — Dos Tributos</ClauseTitle>
      <P>
        Nos valores previstos nas cláusulas acima estão incluídos todos os tributos incidentes, ficando a cargo da
        Contratada o recolhimento de todos os tributos que, de acordo com a legislação em vigor, venham a incidir
        sobre o presente contrato.
      </P>

      <ClauseTitle>Cláusula 5ª — Das Obrigações das Partes</ClauseTitle>
      <p className="text-[11.5px] font-bold mb-1">São obrigações da Contratada:</p>
      <ul>
        <Li>Cumprir a entrega prevista na Cláusula 2ª dentro do prazo e formato acordados;</Li>
        <Li>Manter postura profissional e alinhada ao briefing de marca fornecido pela Contratante;</Li>
        <Li>Comunicar previamente, quando possível, qualquer imprevisto que possa impactar a entrega.</Li>
      </ul>
      <p className="text-[11.5px] font-bold mb-1 mt-2">São obrigações da Contratante:</p>
      <ul>
        <Li>Efetuar o pagamento no prazo estabelecido na Cláusula 4ª;</Li>
        <Li>
          Fornecer o briefing de marca com antecedência mínima de {BRIEFING_DIAS} dias do início da produção;
        </Li>
        <Li>Não solicitar alterações na linha editorial, no formato ou na narrativa do criador além do previsto na Cláusula 3ª.</Li>
      </ul>

      <ClauseTitle>Cláusula 6ª — Da Propriedade Intelectual e Direito de Imagem</ClauseTitle>
      <P>
        Os direitos autorais sobre o conteúdo produzido permanecem de titularidade da Contratada, observado o
        disposto na Lei nº 9.610/98.
      </P>
      <P>
        A Contratada concede à Contratante, de forma irrevogável, irretratável, não exclusiva e sem qualquer custo
        adicional, licença para utilizar o conteúdo produzido em razão deste contrato, incluindo sua imagem, voz e
        nome associados {plural ? "aos vídeos" : "ao vídeo"}, em território nacional, por prazo indeterminado.
      </P>
      <P>
        A licença compreende o direito de reproduzir, publicar, editar, adaptar, recortar, impulsionar, utilizar em
        mídia paga, divulgar em redes sociais, websites, aplicativos, apresentações comerciais, materiais
        institucionais e quaisquer outros canais de comunicação da Contratante.
      </P>
      <P>
        A Contratante poderá realizar adaptações de formato, duração, legendas, identidade visual e demais ajustes
        necessários para adequação do conteúdo aos diferentes meios de divulgação, preservando a integridade da
        imagem da Contratada.
      </P>
      <P>Não será devido qualquer valor adicional pela utilização do conteúdo nos termos desta cláusula.</P>

      <ClauseTitle>Cláusula 7ª — Do Desimpedimento</ClauseTitle>
      <P>
        A Contratada declara que não possui impedimento que possa obstar a pactuação do presente instrumento e de
        algum modo prejudicar o cumprimento das obrigações avençadas com a Contratante.
      </P>

      <ClauseTitle>Cláusula 7.1ª — Da Indenização</ClauseTitle>
      <P>
        Obriga-se a Contratada a manter e preservar a Contratante livre e independente de quaisquer medidas
        judiciais e/ou extrajudiciais em decorrência da celebração do presente contrato, devendo indenizar e
        ressarcir a Contratante em decorrência de quaisquer prejuízos e despesas.
      </P>
      <P>
        Parágrafo único: Fica a Contratada obrigada a ressarcir a Contratante, no prazo de 48 (quarenta e oito)
        horas contados a partir da notificação extrajudicial, de quaisquer despesas e/ou prejuízos relativos a
        indenizações, danos, valores, remunerações, custas ou despesas processuais, honorários advocatícios e
        quaisquer outros encargos oriundos de demandas judiciais e/ou extrajudiciais atribuíveis à conduta e
        responsabilidade da Contratada.
      </P>

      <ClauseTitle>Cláusula 8ª — Da Rescisão</ClauseTitle>
      <P>
        Em caso de rescisão por iniciativa da Contratante após a assinatura, sem justa causa: os valores já pagos
        não serão devolvidos. Em caso de rescisão por iniciativa da Contratada sem justificativa de força maior:
        devolução integral do valor recebido, em até 5 (cinco) dias úteis.
      </P>
      <P>
        Considera-se força maior qualquer evento imprevisível e alheio à vontade das partes, incluindo epidemias,
        calamidades ou impedimento por autoridades competentes.
      </P>

      <ClauseTitle>Cláusula 9ª — Do Prazo</ClauseTitle>
      <P>
        Este contrato tem vigência a partir da data de sua assinatura até a efetiva entrega, aprovação e publicação{" "}
        {plural ? "dos vídeos previstos" : "do vídeo previsto"} na Cláusula 2ª, observado o prazo de{" "}
        {diasLabel(PRAZO_ENTREGA_DIAS)} corridos indicado naquela cláusula.
      </P>

      <ClauseTitle>Cláusula 10ª — Do Foro</ClauseTitle>
      <P>
        Fica eleito o foro da Comarca de Recife, para dirimir quaisquer dúvidas ou litígios oriundos do presente
        contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.
      </P>

      <ClauseTitle>Cláusula 11ª — Das Disposições Gerais</ClauseTitle>
      <P>
        Este contrato representa o acordo integral entre as partes sobre o objeto aqui descrito. Qualquer alteração
        deverá ser formalizada por meio de aditivo assinado por ambas as partes. O presente instrumento é firmado em
        02 (duas) vias de igual teor e forma.
      </P>

      <p className="text-[11.5px] mt-6 mb-8">Recife (PE), {dataExtenso(data_contrato)}.</p>

      <p className="text-[11.5px] font-bold mb-8 text-center">ASSINATURAS</p>
      <div className="grid grid-cols-2 gap-8 mb-10">
        <div>
          <div className="border-t border-neutral-800 pt-1.5 text-center">
            <p className="text-[11px] font-bold">CONTRATANTE</p>
            <p className="text-[11px]">
              {contratante_representante} — {contratante_razao_social}
            </p>
          </div>
        </div>
        <div>
          <div className="border-t border-neutral-800 pt-1.5 text-center">
            <p className="text-[11px] font-bold">CONTRATADA</p>
            <p className="text-[11px]">
              {CONTRATADA.representante} — {CONTRATADA.razaoSocial}
            </p>
          </div>
        </div>
      </div>

      <p className="text-[11px] mb-1">
        Testemunha 1: &nbsp; Nome: {testemunha1_nome} &nbsp;&nbsp; CPF: {testemunha1_cpf}
      </p>
      <p className="text-[11px]">
        Testemunha 2: &nbsp; Nome: {testemunha2_nome || "_______________________________"} &nbsp;&nbsp; CPF:{" "}
        {testemunha2_cpf || "_______________"}
      </p>
    </div>
  );
}
