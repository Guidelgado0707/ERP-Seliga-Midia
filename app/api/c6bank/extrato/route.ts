import { NextRequest, NextResponse } from "next/server";
import { fetchExtrato } from "@/lib/c6bank";

export const dynamic = "force-dynamic";
export const maxDuration = 30; // até 30s (suficiente para mTLS + token + extrato)

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json(
      { error: "Parâmetros 'start' e 'end' são obrigatórios (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  // Valida que o intervalo não excede 30 dias
  const diff =
    (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24);
  if (diff > 30) {
    return NextResponse.json(
      { error: "O intervalo máximo é de 30 dias" },
      { status: 400 }
    );
  }

  try {
    const result = await fetchExtrato(start, end);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[C6 extrato]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
