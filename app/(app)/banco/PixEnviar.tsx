"use client";

import { useCallback, useEffect, useState } from "react";
import { useBancoPinToken } from "./PinGate";

// ---------- tipos ----------
type Destinatario = {
  id: string;
  nome: string;
  chave: string;
  tipo: "cpf" | "cnpj" | "email" | "telefone" | "aleatoria";
  observacao: string | null;
  ativo: boolean;
  cadastrado_em: string;
};

type Solicitacao = {
  id: string;
  destinatario_id: string;
  valor: number;
  descricao: string | null;
  status: "pendente_aprovacao" | "aprovada" | "enviada" | "falhou" | "cancelada";
  pedido_por: string;
  pedido_em: string;
  aprovado_por: string | null;
  aprovado_em: string | null;
  enviado_em: string | null;
  end_to_end_id: string | null;
  erro: string | null;
  destinatario?: { nome: string; chave: string; tipo: string };
};

const TIPOS: Destinatario["tipo"][] = ["cpf", "cnpj", "email", "telefone", "aleatoria"];

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDateTime(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("pt-BR");
}

export default function PixEnviar() {
  const pinToken = useBancoPinToken();
  const [subAba, setSubAba] = useState<"enviar" | "pendentes" | "destinatarios" | "historico">("enviar");

  return (
    <div className="space-y-4">
      {/* aviso — PIX real */}
      <div className="bg-crimson-soft border border-crimson/30 rounded-xl p-3.5 text-sm text-crimson-dark">
        ⚠️ <strong>PIX real.</strong> Movimento dinheiro de verdade da conta C6. Confira valor
        e destinatário antes de confirmar. Todo envio é auditado e notifica todos os sócios por
        e-mail.
      </div>

      {/* sub-abas */}
      <div className="flex gap-1 border-b border-line text-sm">
        {[
          { k: "enviar", label: "Enviar" },
          { k: "pendentes", label: "Pendentes de aprovação" },
          { k: "destinatarios", label: "Destinatários" },
          { k: "historico", label: "Histórico" },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => setSubAba(t.k as typeof subAba)}
            className={`px-3 py-2 font-medium border-b-2 transition-colors ${
              subAba === t.k
                ? "border-ledger text-ledger"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subAba === "enviar" && <PainelEnviar pinToken={pinToken} onEnviado={() => setSubAba("historico")} />}
      {subAba === "pendentes" && <PainelPendentes pinToken={pinToken} />}
      {subAba === "destinatarios" && <PainelDestinatarios />}
      {subAba === "historico" && <PainelHistorico />}
    </div>
  );
}

// =============================================================================
// SUB-ABA: Enviar PIX
// =============================================================================
function PainelEnviar({ pinToken, onEnviado }: { pinToken: string | null; onEnviado: () => void }) {
  const [destinatarios, setDestinatarios] = useState<Destinatario[]>([]);
  const [destinatarioId, setDestinatarioId] = useState("");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro" | "info"; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    fetch("/api/pix/destinatarios", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setDestinatarios(d.destinatarios ?? []))
      .catch(() => {});
  }, []);

  async function solicitar(e: React.FormEvent) {
    e.preventDefault();
    if (!pinToken) {
      setMsg({ tipo: "erro", texto: "PIN da aba banco não verificado" });
      return;
    }
    setEnviando(true);
    setMsg(null);
    try {
      // 1. solicita
      const res = await fetch("/api/pix/solicitar", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-banco-pin-token": pinToken },
        body: JSON.stringify({ destinatario_id: destinatarioId, valor: Number(valor), descricao }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      const sol = data.solicitacao as Solicitacao;

      // 2. se precisa aprovação → só notifica e sai
      if (data.precisaAprovacao) {
        setMsg({
          tipo: "info",
          texto: `Solicitação criada — precisa de aprovação de outro sócio antes de enviar. Vá na aba "Pendentes de aprovação" pra acompanhar.`,
        });
        setValor("");
        setDescricao("");
        setDestinatarioId("");
        return;
      }

      // 3. auto-aprovada (<R$1000) → dispara envio direto
      const confirmar = confirm(
        `Confirmar envio de ${fmtBRL(Number(valor))} pra ${
          destinatarios.find((d) => d.id === destinatarioId)?.nome ?? "destinatário"
        }?\n\nEssa ação é irreversível.`,
      );
      if (!confirmar) {
        setMsg({ tipo: "info", texto: "Envio cancelado. Solicitação segue aprovada — você pode disparar depois." });
        return;
      }

      const resEnv = await fetch("/api/pix/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-banco-pin-token": pinToken },
        body: JSON.stringify({ solicitacao_id: sol.id }),
      });
      const dataEnv = await resEnv.json();
      if (!resEnv.ok || !dataEnv.ok) throw new Error(dataEnv.error ?? `HTTP ${resEnv.status}`);

      setMsg({
        tipo: "ok",
        texto: `✅ PIX enviado! endToEnd: ${dataEnv.endToEnd ?? "(sem retorno)"}. Notificação por e-mail disparada.`,
      });
      setValor("");
      setDescricao("");
      setDestinatarioId("");
      setTimeout(onEnviado, 2000);
    } catch (e) {
      setMsg({ tipo: "erro", texto: (e as Error).message });
    } finally {
      setEnviando(false);
    }
  }

  if (destinatarios.length === 0) {
    return (
      <div className="bg-white border border-line rounded-xl p-5 text-sm text-muted">
        Nenhum destinatário cadastrado. Vá em <strong>Destinatários</strong> pra cadastrar antes.
      </div>
    );
  }

  return (
    <form onSubmit={solicitar} className="bg-white border border-line rounded-xl p-5 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted font-medium block mb-1">Destinatário</label>
          <select
            required
            value={destinatarioId}
            onChange={(e) => setDestinatarioId(e.target.value)}
            className="w-full border border-line rounded-md px-3 py-2 text-sm"
          >
            <option value="">Selecione…</option>
            {destinatarios.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nome} · {d.tipo.toUpperCase()} · {d.chave}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted font-medium block mb-1">Valor (R$)</label>
          <input
            required
            type="number"
            step="0.01"
            min="0.01"
            max="20000"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="Ex: 250.00"
            className="w-full border border-line rounded-md px-3 py-2 text-sm font-mono"
          />
          <p className="text-[11px] text-muted mt-1">Limite: R$ 1.000/tx sem aprovação. Acima disso precisa aprovação de outro sócio.</p>
        </div>
      </div>
      <div>
        <label className="text-xs text-muted font-medium block mb-1">Motivo (opcional)</label>
        <input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          maxLength={140}
          placeholder="Ex: reembolso viagem SP"
          className="w-full border border-line rounded-md px-3 py-2 text-sm"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          disabled={enviando || !pinToken}
          type="submit"
          className="bg-ledger text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-ledger-dark transition-colors disabled:opacity-60"
        >
          {enviando ? "Processando…" : "Solicitar PIX"}
        </button>
        {!pinToken && <span className="text-xs text-crimson">PIN não verificado — não dá pra solicitar.</span>}
      </div>
      {msg && (
        <div
          className={`text-sm rounded-md px-3 py-2.5 ${
            msg.tipo === "ok" ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
            : msg.tipo === "erro" ? "bg-crimson-soft text-crimson-dark border border-crimson/30"
            : "bg-amber-50 text-amber-800 border border-amber-200"
          }`}
        >
          {msg.texto}
        </div>
      )}
    </form>
  );
}

// =============================================================================
// SUB-ABA: Pendentes de aprovação
// =============================================================================
function PainelPendentes({ pinToken }: { pinToken: string | null }) {
  const [pendentes, setPendentes] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/pix/solicitacoes?status=pendente_aprovacao", { cache: "no-store" });
    const d = await res.json();
    setPendentes(d.solicitacoes ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function decidir(id: string, acao: "aprovar" | "cancelar") {
    if (!pinToken) { alert("PIN não verificado"); return; }
    setProcessando(id);
    try {
      const res = await fetch("/api/pix/aprovar", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-banco-pin-token": pinToken },
        body: JSON.stringify({ solicitacao_id: id, acao }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      await carregar();
    } catch (e) {
      alert(`Erro: ${(e as Error).message}`);
    } finally {
      setProcessando(null);
    }
  }

  async function enviarAgora(id: string) {
    if (!pinToken) { alert("PIN não verificado"); return; }
    if (!confirm("Enviar este PIX agora? Ação irreversível.")) return;
    setProcessando(id);
    try {
      const res = await fetch("/api/pix/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-banco-pin-token": pinToken },
        body: JSON.stringify({ solicitacao_id: id }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      alert(`✅ PIX enviado! endToEnd: ${d.endToEnd ?? "(sem retorno)"}`);
      await carregar();
    } catch (e) {
      alert(`Erro: ${(e as Error).message}`);
    } finally {
      setProcessando(null);
    }
  }

  if (loading) return <p className="text-sm text-muted">Carregando…</p>;
  if (pendentes.length === 0)
    return <div className="bg-white border border-line rounded-xl p-5 text-sm text-muted">Nenhuma solicitação aguardando aprovação.</div>;

  return (
    <div className="bg-white border border-line rounded-xl divide-y divide-line">
      {pendentes.map((s) => (
        <div key={s.id} className="p-4 flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink truncate">
              {fmtBRL(Number(s.valor))} pra {s.destinatario?.nome ?? "—"}
            </p>
            <p className="text-xs text-muted">
              {s.descricao ?? "sem motivo"} · pedido {fmtDateTime(s.pedido_em)}
            </p>
          </div>
          <button
            onClick={() => decidir(s.id, "aprovar")}
            disabled={processando === s.id}
            className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            ✓ Aprovar
          </button>
          <button
            onClick={() => decidir(s.id, "cancelar")}
            disabled={processando === s.id}
            className="px-3 py-1.5 rounded-md border border-line text-crimson text-xs font-medium hover:bg-crimson-soft disabled:opacity-50"
          >
            ✕ Cancelar
          </button>
          <button
            onClick={() => enviarAgora(s.id)}
            disabled={processando === s.id}
            title="Só funciona depois de aprovada"
            className="px-3 py-1.5 rounded-md bg-ledger text-white text-xs font-medium hover:bg-ledger-dark disabled:opacity-50"
          >
            → Enviar agora
          </button>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// SUB-ABA: Destinatários
// =============================================================================
function PainelDestinatarios() {
  const [lista, setLista] = useState<Destinatario[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<{ nome: string; chave: string; tipo: Destinatario["tipo"]; observacao: string }>({
    nome: "", chave: "", tipo: "cnpj", observacao: "",
  });
  const [saving, setSaving] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/pix/destinatarios", { cache: "no-store" });
    const d = await res.json();
    setLista(d.destinatarios ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/pix/destinatarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      setForm({ nome: "", chave: "", tipo: "cnpj", observacao: "" });
      setShowForm(false);
      await carregar();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function desativar(id: string) {
    if (!confirm("Desativar esse destinatário? Ele não vai poder receber PIX pelo sistema mais.")) return;
    await fetch(`/api/pix/destinatarios?id=${id}`, { method: "PATCH" });
    await carregar();
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm((s) => !s)}
          className="bg-ledger text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-ledger-dark"
        >
          {showForm ? "Cancelar" : "+ Novo destinatário"}
        </button>
      </div>
      {showForm && (
        <form onSubmit={adicionar} className="bg-white border border-line rounded-xl p-5 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted font-medium block mb-1">Nome</label>
              <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
                className="w-full border border-line rounded-md px-3 py-2 text-sm" placeholder="Ex: Cartão Azul Itaú" />
            </div>
            <div>
              <label className="text-xs text-muted font-medium block mb-1">Tipo de chave</label>
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as Destinatario["tipo"] })}
                className="w-full border border-line rounded-md px-3 py-2 text-sm">
                {TIPOS.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-muted font-medium block mb-1">Chave PIX</label>
              <input required value={form.chave} onChange={(e) => setForm({ ...form, chave: e.target.value })}
                className="w-full border border-line rounded-md px-3 py-2 text-sm font-mono" />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-muted font-medium block mb-1">Observação (opcional)</label>
              <input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                className="w-full border border-line rounded-md px-3 py-2 text-sm" />
            </div>
          </div>
          <button disabled={saving} type="submit"
            className="bg-ledger text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-ledger-dark disabled:opacity-60">
            {saving ? "Salvando…" : "Cadastrar"}
          </button>
        </form>
      )}
      {loading ? <p className="text-sm text-muted">Carregando…</p>
      : lista.length === 0 ? <div className="bg-white border border-line rounded-xl p-5 text-sm text-muted">Nenhum destinatário cadastrado.</div>
      : (
        <div className="bg-white border border-line rounded-xl divide-y divide-line">
          {lista.map((d) => (
            <div key={d.id} className="p-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink truncate">{d.nome}</p>
                <p className="text-xs text-muted">{d.tipo.toUpperCase()} · <span className="font-mono">{d.chave}</span> {d.observacao ? `· ${d.observacao}` : ""}</p>
              </div>
              <button onClick={() => desativar(d.id)} className="text-xs text-crimson hover:underline">Desativar</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SUB-ABA: Histórico
// =============================================================================
function PainelHistorico() {
  const [lista, setLista] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/pix/solicitacoes?limit=100", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setLista(d.solicitacoes ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-muted">Carregando…</p>;
  if (lista.length === 0) return <div className="bg-white border border-line rounded-xl p-5 text-sm text-muted">Nenhuma solicitação ainda.</div>;

  const cor = (s: Solicitacao["status"]) => ({
    pendente_aprovacao: "bg-amber-50 text-amber-800 border-amber-200",
    aprovada: "bg-sky-50 text-sky-800 border-sky-200",
    enviada: "bg-emerald-50 text-emerald-800 border-emerald-200",
    falhou: "bg-crimson-soft text-crimson-dark border-crimson/30",
    cancelada: "bg-gray-100 text-gray-600 border-gray-200",
  }[s]);

  return (
    <div className="bg-white border border-line rounded-xl divide-y divide-line">
      {lista.map((s) => (
        <div key={s.id} className="p-3.5 flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">
              {fmtBRL(Number(s.valor))} pra {s.destinatario?.nome ?? "—"}
            </p>
            <p className="text-xs text-muted">
              {s.descricao ?? "sem motivo"} · pedido {fmtDateTime(s.pedido_em)}
              {s.enviado_em ? ` · enviado ${fmtDateTime(s.enviado_em)}` : ""}
              {s.end_to_end_id ? ` · e2e ${s.end_to_end_id}` : ""}
            </p>
            {s.erro && <p className="text-xs text-crimson mt-1">Erro: {s.erro}</p>}
          </div>
          <span className={`text-xs font-medium px-2 py-1 rounded-md border ${cor(s.status)}`}>
            {s.status.replace("_", " ")}
          </span>
        </div>
      ))}
    </div>
  );
}
