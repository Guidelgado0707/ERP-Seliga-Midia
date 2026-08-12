import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const maxDuration = 60;

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-5";

type ItemExtraido = {
  data: string;
  descricao: string;
  valor: number;
  tipo: "compra" | "pagamento_fatura" | "estorno_iof" | "outro";
  categoria_sugerida: string;
};

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY não configurada no servidor. Peça pro administrador configurar." },
      { status: 500 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Não consegui ler os arquivos enviados." }, { status: 400 });
  }

  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  const categoriasExistentes = (formData.get("categorias") as string) || "";

  if (files.length === 0) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  }
  if (files.length > 8) {
    return NextResponse.json({ error: "Manda no máximo 8 arquivos por vez." }, { status: 400 });
  }

  const contentBlocks: Record<string, unknown>[] = [];
  for (const file of files) {
    const buf = Buffer.from(await file.arrayBuffer());
    const base64 = buf.toString("base64");
    const mediaType = file.type || "image/jpeg";
    if (mediaType === "application/pdf") {
      contentBlocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: base64 },
      });
    } else {
      contentBlocks.push({
        type: "image",
        source: { type: "base64", media_type: mediaType, data: base64 },
      });
    }
  }

  const prompt = `Você está lendo uma fatura de cartão de crédito brasileira (pode vir em várias imagens/páginas, todas da mesma fatura).

Extraia TODOS os lançamentos de compras/débitos da fatura, um por linha. Para cada um, retorne um objeto com:
- "data": data no formato DD/MM (ou DD/MM/AAAA se o ano aparecer)
- "descricao": nome do estabelecimento, resumido e legível (inclua "Parcela X/Y" se aparecer)
- "valor": valor em reais, número positivo (use negativo só para estornos/créditos reais ao cliente)
- "tipo": "compra" (lançamento normal), "pagamento_fatura" (linha de "pagamento efetuado", "pag fatura boleto" — dinheiro que o cliente pagou PARA quitar a fatura, NÃO é despesa), "estorno_iof" (linha de "IOF Transações Exterior", tratada separada da compra internacional que a originou), ou "outro"
- "categoria_sugerida": escolha a categoria mais adequada dentre esta lista existente, ou sugira uma categoria nova, curta e clara, se nenhuma servir bem:
${categoriasExistentes || "(nenhuma categoria cadastrada ainda)"}

Regras importantes:
- Linhas "IOF Transações Exterior" são um lançamento SEPARADO com tipo "estorno_iof" e categoria "Taxas, IOF e Estornos" — não some no valor da compra internacional principal, mantenha os dois valores separados.
- Toda corrida de aplicativo de transporte (DL*UBERRIDES, Uber *Trip, 99, etc.) vai na categoria "Transporte / Uber".
- NÃO invente lançamentos que não estão na imagem. Se não conseguir ler um valor com certeza, ainda assim inclua sua melhor leitura.
- Marque tipo "pagamento_fatura" para linhas de pagamento da própria fatura (elas serão descartadas automaticamente, mas ajudam a não confundir com compras).
- Responda APENAS com um JSON válido, sem nenhum texto antes ou depois, exatamente neste formato:
{"itens": [{"data": "...", "descricao": "...", "valor": 0, "tipo": "...", "categoria_sugerida": "..."}]}`;

  contentBlocks.push({ type: "text", text: prompt });

  try {
    const resp = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        messages: [{ role: "user", content: contentBlocks }],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return NextResponse.json({ error: `Erro na API da Anthropic (${resp.status}): ${errText}` }, { status: 502 });
    }

    const data = await resp.json();
    const textOutput = (data?.content ?? []).find((c: { type: string }) => c.type === "text")?.text ?? "";

    const jsonMatch = textOutput.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Não consegui interpretar a resposta da IA. Tenta de novo." }, { status: 502 });
    }

    let parsed: { itens?: ItemExtraido[] };
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json({ error: "A IA devolveu um JSON inválido. Tenta de novo." }, { status: 502 });
    }

    const itens = (parsed.itens ?? []).filter((i) => i && i.tipo !== "pagamento_fatura");

    return NextResponse.json({ itens });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido ao processar a fatura.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
