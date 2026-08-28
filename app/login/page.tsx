"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // se a conta tiver 2FA ativado, depois da senha aparece esse passo extra
  const [checandoMfa, setCheckandoMfa] = useState(true);
  const [precisaMfa, setPrecisaMfa] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [verificando, setVerificando] = useState(false);

  const avaliarMfaOuEntrar = useCallback(async () => {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (data && data.currentLevel === "aal1" && data.nextLevel === "aal2") {
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const factor = factorsData?.totp.find((f) => f.status === "verified") ?? null;
      if (factor) {
        setFactorId(factor.id);
        setPrecisaMfa(true);
        return;
      }
    }
    router.push("/dashboard");
    router.refresh();
  }, [supabase, router]);

  // ao carregar a página, checa se já existe uma sessão no meio do desafio de
  // 2FA (ex: o middleware trouxe de volta pra cá porque falta confirmar o código)
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        await avaliarMfaOuEntrar();
      }
      setCheckandoMfa(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("E-mail ou senha inválidos.");
      setLoading(false);
      return;
    }

    await avaliarMfaOuEntrar();
    setLoading(false);
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setVerificando(true);
    setError(null);
    try {
      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeErr) throw challengeErr;
      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: codigo,
      });
      if (verifyErr) throw verifyErr;
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código inválido.");
    } finally {
      setVerificando(false);
    }
  }

  if (checandoMfa) {
    return <div className="min-h-screen bg-paper" />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-seliga-midia.png" alt="Seliga Mídia" className="h-20 w-auto mx-auto mb-3" />
          <p className="font-display font-semibold text-2xl text-ink">Gestão Seliga Mídia</p>
          <p className="text-sm text-muted mt-1">
            {precisaMfa
              ? "Digite o código do seu app autenticador"
              : "Entre para acessar sua gestão financeira"}
          </p>
        </div>

        {precisaMfa ? (
          <form onSubmit={handleMfaSubmit} className="bg-white rounded-lg shadow-sm p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">
                Código de 6 dígitos
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                className="w-full px-3 py-2.5 rounded-md border border-line text-center text-lg tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-ledger"
                placeholder="000000"
              />
            </div>
            {error && <p className="text-sm text-crimson">{error}</p>}
            <button
              type="submit"
              disabled={verificando || codigo.length < 6}
              className="w-full bg-ledger text-white text-sm font-medium py-2.5 rounded-md hover:bg-ledger-dark transition-colors disabled:opacity-60"
            >
              {verificando ? "Verificando..." : "Confirmar"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">E-mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 rounded-md border border-line text-sm focus:outline-none focus:ring-2 focus:ring-ledger"
                placeholder="voce@agencia.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Senha</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-md border border-line text-sm focus:outline-none focus:ring-2 focus:ring-ledger"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-sm text-crimson">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-ledger text-white text-sm font-medium py-2.5 rounded-md hover:bg-ledger-dark transition-colors disabled:opacity-60"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        )}

        <p className="text-xs text-muted text-center mt-4">
          Sua conta é criada direto no painel do Supabase — veja o README do projeto.
        </p>
      </div>
    </div>
  );
}
