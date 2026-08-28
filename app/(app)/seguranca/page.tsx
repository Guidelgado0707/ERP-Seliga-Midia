"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabaseClient";

type Factor = { id: string; factor_type: string; status: string; friendly_name?: string | null };

export default function SegurancaPage() {
  const supabase = createClient();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);

  const [enrollando, setEnrollando] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [removendo, setRemovendo] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (!error && data) {
      setFactors(data.totp.filter((f) => f.status === "verified"));
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function iniciarCadastro() {
    setErro(null);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    if (error) {
      setErro(error.message);
      return;
    }
    setFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setEnrollando(true);
  }

  async function confirmarCadastro(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setVerificando(true);
    setErro(null);
    try {
      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeErr) throw challengeErr;
      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: codigo,
      });
      if (verifyErr) throw verifyErr;
      setEnrollando(false);
      setQrCode(null);
      setSecret(null);
      setFactorId(null);
      setCodigo("");
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    } finally {
      setVerificando(false);
    }
  }

  async function cancelarCadastro() {
    if (factorId) {
      await supabase.auth.mfa.unenroll({ factorId });
    }
    setEnrollando(false);
    setQrCode(null);
    setSecret(null);
    setFactorId(null);
    setCodigo("");
    setErro(null);
  }

  async function remover(id: string) {
    if (
      !confirm(
        "Tem certeza que quer desativar o 2FA? Sua conta ficará protegida só pela senha."
      )
    )
      return;
    setRemovendo(id);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) setErro(error.message);
    else await carregar();
    setRemovendo(null);
  }

  const temFactorAtivo = factors.length > 0;

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-ink">Segurança da conta</h1>
        <p className="text-sm text-muted mt-0.5">Autenticação de dois fatores (2FA)</p>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Carregando…</p>
      ) : enrollando ? (
        <div className="bg-white border border-line rounded-xl p-5 space-y-4">
          <p className="text-sm font-medium text-ink">
            1. Escaneie o QR code com seu app autenticador (Google Authenticator, Authy, 1Password
            etc.)
          </p>
          {qrCode && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrCode} alt="QR code do 2FA" className="w-40 h-40 mx-auto" />
          )}
          {secret && (
            <p className="text-xs text-muted text-center break-all">
              Ou digite manualmente: <code className="font-mono">{secret}</code>
            </p>
          )}
          <form onSubmit={confirmarCadastro} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">
                2. Digite o código de 6 dígitos gerado pelo app
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="000000"
                className="w-full border border-line rounded-md px-3 py-2.5 text-center text-lg tracking-[0.3em] focus:outline-none focus:ring-1 focus:ring-ledger"
              />
            </div>
            {erro && <p className="text-sm text-crimson">{erro}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={verificando || codigo.length < 6}
                className="flex-1 px-4 py-2.5 rounded-md bg-ledger text-white text-sm font-medium hover:bg-ledger-dark transition-colors disabled:opacity-50"
              >
                {verificando ? "Confirmando…" : "Confirmar"}
              </button>
              <button
                type="button"
                onClick={cancelarCadastro}
                className="px-4 py-2.5 rounded-md border border-line text-sm text-muted hover:text-ink transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      ) : temFactorAtivo ? (
        <div className="bg-white border border-line rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-emerald-600 text-lg">✓</span>
            <p className="text-sm font-medium text-ink">2FA ativado</p>
          </div>
          <p className="text-sm text-muted">
            Seu login agora pede senha + código do app autenticador toda vez.
          </p>
          {erro && <p className="text-sm text-crimson">{erro}</p>}
          {factors.map((f) => (
            <button
              key={f.id}
              onClick={() => remover(f.id)}
              disabled={removendo === f.id}
              className="text-sm text-crimson hover:underline disabled:opacity-50"
            >
              {removendo === f.id ? "Desativando…" : "Desativar 2FA"}
            </button>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-line rounded-xl p-5 space-y-3">
          <p className="text-sm text-muted">
            Adicione uma camada extra de proteção: depois de ativar, o login vai pedir a senha e
            um código de 6 dígitos gerado por um app autenticador no seu celular.
          </p>
          {erro && <p className="text-sm text-crimson">{erro}</p>}
          <button
            onClick={iniciarCadastro}
            className="px-4 py-2 rounded-md bg-ledger text-white text-sm font-medium hover:bg-ledger-dark transition-colors"
          >
            Ativar 2FA
          </button>
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
        <strong>Importante:</strong> se você perder acesso ao app autenticador, não tem como
        desativar o 2FA sozinho — quem administra o projeto no Supabase precisa remover o fator
        manualmente pelo painel (Authentication → Users → seu usuário → Multi-Factor).
      </div>
    </div>
  );
}
