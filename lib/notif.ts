/**
 * Notificação por e-mail via Resend. Usado pra alertar os sócios a cada
 * PIX enviado — regra 5 do desenho de segurança.
 *
 * Configuração via env:
 *   RESEND_API_KEY    — API key do Resend (começa com "re_")
 *   RESEND_FROM       — remetente (precisa ter domínio verificado, ex:
 *                       "Seliga Mídia <alertas@seu-dominio.com.br>").
 *                       Enquanto não tem domínio: usa "onboarding@resend.dev"
 *                       (que só entrega pra e-mail cadastrado no Resend).
 *   NOTIFY_EMAILS     — e-mails separados por vírgula
 *                       ex: guilherme@..., andre@..., pedro@...
 *
 * Falha silenciosa: se não estiver configurado ou falhar, log na
 * auditoria — não bloqueia o PIX que já saiu.
 */

export async function notificarEmail(assunto: string, corpo: string): Promise<{ enviado: boolean; erro?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  const to = process.env.NOTIFY_EMAILS;

  if (!key || !from || !to) {
    return { enviado: false, erro: "Resend não configurado (RESEND_API_KEY / RESEND_FROM / NOTIFY_EMAILS)" };
  }

  const emails = to.split(",").map((s) => s.trim()).filter(Boolean);
  if (emails.length === 0) return { enviado: false, erro: "NOTIFY_EMAILS vazio" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: emails,
        subject: assunto,
        text: corpo,
        html: corpo.replace(/\n/g, "<br>"),
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      return { enviado: false, erro: `HTTP ${res.status}: ${txt.slice(0, 300)}` };
    }
    return { enviado: true };
  } catch (e) {
    return { enviado: false, erro: (e as Error).message };
  }
}

/**
 * Monta a mensagem de PIX enviado. Curta e clara — se algo estiver errado,
 * o sócio consegue reagir rápido.
 */
export function msgPixEnviado(params: {
  valor: number;
  destinatario: string;
  descricao?: string;
  pedido_por: string;
  aprovado_por?: string;
  end_to_end_id?: string;
}): { assunto: string; corpo: string } {
  const valorFmt = params.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const assunto = `🏦 PIX enviado — ${valorFmt} pra ${params.destinatario}`;
  const linhas = [
    `Um PIX acabou de sair da conta da Seliga Mídia (C6):`,
    ``,
    `Valor: ${valorFmt}`,
    `Destinatário: ${params.destinatario}`,
  ];
  if (params.descricao) linhas.push(`Motivo: ${params.descricao}`);
  linhas.push(`Pediu: ${params.pedido_por}`);
  if (params.aprovado_por) linhas.push(`Aprovou: ${params.aprovado_por}`);
  if (params.end_to_end_id) linhas.push(``, `ID C6 (endToEnd): ${params.end_to_end_id}`);
  linhas.push(``, `Se você NÃO reconhece esse PIX, fale AGORA com o Guilherme e trave a conta no C6.`);
  return { assunto, corpo: linhas.join("\n") };
}
