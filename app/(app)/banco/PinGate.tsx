"use client";

import { createContext, useContext, useState } from "react";

/**
 * Trava a aba Banco C6 atrás de um PIN compartilhado (3 pessoas com acesso).
 * Pedido toda vez que a aba é montada — o token fica só em memória (nunca
 * localStorage/sessionStorage), então navegar pra outra aba e voltar pede de
 * novo. O servidor confere o PIN e assina um token de curta duração (15 min)
 * que as rotas do C6 Bank exigem em toda chamada (ver lib/bancoPin.ts).
 */

const PinTokenContext = createContext<string | null>(null);

/** Hook pra usar dentro de qualquer componente montado dentro do <PinGate>. */
export function useBancoPinToken(): string | null {
  return useContext(PinTokenContext);
}

export default function PinGate({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setVerificando(true);
    setErro(null);
    try {
      const res = await fetch("/api/banco/verificar-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setToken(data.token);
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    } finally {
      setVerificando(false);
      setPin("");
    }
  }

  if (!token) {
    return (
      <div className="max-w-xs mx-auto mt-20 bg-white border border-line rounded-xl p-6 shadow-sm">
        <div className="text-center mb-5">
          <p className="text-3xl mb-2">🔒</p>
          <h1 className="text-lg font-display font-bold text-ink">Área protegida</h1>
          <p className="text-sm text-muted mt-1">Digite o PIN pra acessar o Banco C6</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="• • • • • •"
            className="w-full border border-line rounded-md px-3 py-2.5 text-center text-xl tracking-[0.4em] focus:outline-none focus:ring-1 focus:ring-ledger"
          />
          {erro && <p className="text-sm text-crimson text-center">{erro}</p>}
          <button
            type="submit"
            disabled={verificando || !pin}
            className="w-full px-4 py-2.5 rounded-md bg-ledger text-white text-sm font-medium hover:bg-ledger-dark transition-colors disabled:opacity-50"
          >
            {verificando ? "Verificando…" : "Entrar"}
          </button>
        </form>
      </div>
    );
  }

  return <PinTokenContext.Provider value={token}>{children}</PinTokenContext.Provider>;
}
