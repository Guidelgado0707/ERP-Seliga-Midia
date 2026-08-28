import { NextRequest, NextResponse } from "next/server";
import { checarPin, gerarToken } from "@/lib/bancoPin";

export const dynamic = "force-dynamic";

// pequeno freio contra tentativa de força bruta (por instância de servidor;
// reseta a cada cold start, mas já ajuda contra tentativa automatizada básica)
let tentativas = 0;
let bloqueadoAte = 0;

export async function POST(request: NextRequest) {
  const agora = Date.now();
  if (agora < bloqueadoAte) {
    const segundos = Math.ceil((bloqueadoAte - agora) / 1000);
    return NextResponse.json(
      { error: `Muitas tentativas. Tente de novo em ${segundos}s.` },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const pin = typeof body?.pin === "string" ? body.pin : "";

  let ok: boolean;
  try {
    ok = checarPin(pin);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Config: ${msg}` }, { status: 500 });
  }

  if (!ok) {
    tentativas += 1;
    if (tentativas >= 5) {
      bloqueadoAte = agora + 60_000; // bloqueia 1 min após 5 erros
      tentativas = 0;
    }
    return NextResponse.json({ error: "PIN incorreto" }, { status: 401 });
  }

  tentativas = 0;
  const token = gerarToken();
  return NextResponse.json({ ok: true, token });
}
