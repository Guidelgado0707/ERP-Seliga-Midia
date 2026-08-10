"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

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

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="font-display font-semibold text-2xl text-ink">Gestão Seliga Mídia</p>
          <p className="text-sm text-muted mt-1">Entre para acessar sua gestão financeira</p>
        </div>

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

        <p className="text-xs text-muted text-center mt-4">
          Sua conta é criada direto no painel do Supabase — veja o README do projeto.
        </p>
      </div>
    </div>
  );
}
