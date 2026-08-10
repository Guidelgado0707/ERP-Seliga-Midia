"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabaseClient";

type Socio = { id: string; nome: string; percentual_participacao: number; ativo: boolean };
type Distribuicao = {
  id: string;
  mes_referencia: string;
  lucro_distribuivel: number;
  dividendos_socios: { id: string; socio_id: string; valor: number; pago: boolean }[];
};
type ProLabore = {
  id: string;
  socio_id: string;
  valor: number;
  data_pagamento: string;
};

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function SociosPage() {
  const supabase = createClient();
  const [socios, setSocios] = useState<Socio[]>([]);
  const [distribuicoes, setDistribuicoes] = useState<Distribuicao[]>([]);
  const [proLabores, setProLabores] = useState<ProLabore[]>([]);
  const [loading, setLoading] = useState(true);

  const [novoSocio, setNovoSocio] = useState({ nome: "", percentual_participacao: "" });
  const [showSocioForm, setShowSocioForm] = useState(false);

  const [novaDistribuicao, setNovaDistribuicao] = useState({ mes: "", lucro: "" });
  const [showDistForm, setShowDistForm] = useState(false);

  const [novoProLabore, setNovoProLabore] = useState({ socio_id: "", valor: "", data_pagamento: "" });
  const [showProLaboreForm, setShowProLaboreForm] = useState(false);

  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, d, pl] = await Promise.all([
      supabase.from("socios").select("*").eq("ativo", true).order("nome"),
      supabase
        .from("dividendos")
        .select("id, mes_referencia, lucro_distribuivel, dividendos_socios(id, socio_id, valor, pago)")
        .order("mes_referencia", { ascending: false }),
      supabase
        .from("pro_labore")
        .select("id, socio_id, valor, data_pagamento")
        .order("data_pagamento", { ascending: false }),
    ]);
    setSocios(s.data ?? []);
    setDistribuicoes((d.data as any) ?? []);
    setProLabores(pl.data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPercentual = socios.reduce((acc, s) => acc + Number(s.percentual_participacao), 0);

  async function handleAddSocio(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await supabase.from("socios").insert({
      nome: novoSocio.nome,
      percentual_participacao: Number(novoSocio.percentual_participacao),
    });
    setNovoSocio({ nome: "", percentual_participacao: "" });
    setShowSocioForm(false);
    setSaving(false);
    load();
  }

  async function handleDistribuir(e: React.FormEvent) {
    e.preventDefault();
    if (socios.length === 0) return;
    setSaving(true);

    const lucro = Number(novaDistribuicao.lucro);
    const mesRef = `${novaDistribuicao.mes}-01`;

    const { data: div } = await supabase
      .from("dividendos")
      .insert({ mes_referencia: mesRef, lucro_distribuivel: lucro })
      .select()
      .single();

    if (div) {
      const linhas = socios.map((s) => ({
        dividendo_id: div.id,
        socio_id: s.id,
        valor: Math.round(lucro * (Number(s.percentual_participacao) / 100) * 100) / 100,
      }));
      await supabase.from("dividendos_socios").insert(linhas);
    }

    setNovaDistribuicao({ mes: "", lucro: "" });
    setShowDistForm(false);
    setSaving(false);
    load();
  }

  async function handleRegistrarProLabore(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const socio = socios.find((s) => s.id === novoProLabore.socio_id);
    const valorNum = Number(novoProLabore.valor);
    const data = novoProLabore.data_pagamento || new Date().toISOString().slice(0, 10);

    const { data: contaPagar } = await supabase
      .from("contas_pagar")
      .insert({
        descricao: `Pró-labore - ${socio?.nome ?? "Sócio"}`,
        valor: valorNum,
        data_vencimento: data,
        data_pagamento: data,
        status: "pago",
      })
      .select()
      .single();

    await supabase.from("pro_labore").insert({
      socio_id: novoProLabore.socio_id,
      valor: valorNum,
      data_pagamento: data,
      conta_pagar_id: contaPagar?.id ?? null,
    });

    setNovoProLabore({ socio_id: "", valor: "", data_pagamento: "" });
    setShowProLaboreForm(false);
    setSaving(false);
    load();
  }

  async function togglePago(id: string, pago: boolean) {
    await supabase
      .from("dividendos_socios")
      .update({ pago: !pago, data_pagamento: !pago ? new Date().toISOString().slice(0, 10) : null })
      .eq("id", id);
    load();
  }

  return (
    <div>
      <div className="mb-6">
        <p className="font-display font-semibold text-xl text-ink">Sócios e Dividendos</p>
        <p className="text-sm text-muted mt-0.5">Participação societária e distribuição de lucros</p>
      </div>

      {/* Sócios */}
      <div className="bg-white rounded-md shadow-sm mb-6">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <p className="text-sm font-medium text-ink">
            Sócios{" "}
            <span className={`text-xs ml-1 ${totalPercentual === 100 ? "text-muted" : "text-crimson"}`}>
              (total: {totalPercentual}%)
            </span>
          </p>
          <button
            onClick={() => setShowSocioForm((s) => !s)}
            className="text-xs font-medium text-ledger-dark hover:underline"
          >
            {showSocioForm ? "Cancelar" : "+ Adicionar sócio"}
          </button>
        </div>

        {showSocioForm && (
          <form onSubmit={handleAddSocio} className="px-5 py-4 border-b border-line flex flex-col md:flex-row gap-3">
            <input
              required
              placeholder="Nome do sócio"
              value={novoSocio.nome}
              onChange={(e) => setNovoSocio({ ...novoSocio, nome: e.target.value })}
              className="flex-1 px-3 py-2.5 rounded-md border border-line text-sm"
            />
            <input
              required
              type="number"
              step="0.01"
              placeholder="% participação"
              value={novoSocio.percentual_participacao}
              onChange={(e) => setNovoSocio({ ...novoSocio, percentual_participacao: e.target.value })}
              className="w-full md:w-40 px-3 py-2.5 rounded-md border border-line text-sm font-mono"
            />
            <button
              disabled={saving}
              type="submit"
              className="bg-ledger text-white text-sm font-medium px-4 py-2.5 rounded-md hover:bg-ledger-dark transition-colors disabled:opacity-60"
            >
              Salvar
            </button>
          </form>
        )}

        <div className="divide-y divide-line">
          {socios.map((s) => (
            <div key={s.id} className="px-5 py-3.5 flex items-center justify-between">
              <p className="text-sm font-medium text-ink">{s.nome}</p>
              <span className="font-mono tabular text-sm text-muted">{Number(s.percentual_participacao)}%</span>
            </div>
          ))}
          {!loading && socios.length === 0 && (
            <p className="px-5 py-6 text-sm text-muted">Cadastre os sócios pra começar a distribuir dividendos.</p>
          )}
        </div>
      </div>

      {/* Pró-labore */}
      <div className="bg-white rounded-md shadow-sm mb-6">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <p className="text-sm font-medium text-ink">Pró-labore</p>
          <button
            onClick={() => setShowProLaboreForm((s) => !s)}
            disabled={socios.length === 0}
            className="text-xs font-medium text-ledger-dark hover:underline disabled:opacity-40"
          >
            {showProLaboreForm ? "Cancelar" : "+ Registrar pró-labore"}
          </button>
        </div>

        {showProLaboreForm && (
          <form
            onSubmit={handleRegistrarProLabore}
            className="px-5 py-4 border-b border-line flex flex-col md:flex-row gap-3"
          >
            <select
              required
              value={novoProLabore.socio_id}
              onChange={(e) => setNovoProLabore({ ...novoProLabore, socio_id: e.target.value })}
              className="px-3 py-2.5 rounded-md border border-line text-sm"
            >
              <option value="">Sócio</option>
              {socios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
            <input
              required
              type="number"
              step="0.01"
              placeholder="Valor (R$)"
              value={novoProLabore.valor}
              onChange={(e) => setNovoProLabore({ ...novoProLabore, valor: e.target.value })}
              className="flex-1 px-3 py-2.5 rounded-md border border-line text-sm font-mono"
            />
            <input
              required
              type="date"
              value={novoProLabore.data_pagamento}
              onChange={(e) => setNovoProLabore({ ...novoProLabore, data_pagamento: e.target.value })}
              className="px-3 py-2.5 rounded-md border border-line text-sm"
            />
            <button
              disabled={saving}
              type="submit"
              className="bg-ledger text-white text-sm font-medium px-4 py-2.5 rounded-md hover:bg-ledger-dark transition-colors disabled:opacity-60"
            >
              Registrar
            </button>
          </form>
        )}

        <div className="divide-y divide-line">
          {proLabores.map((pl) => {
            const socio = socios.find((s) => s.id === pl.socio_id);
            return (
              <div key={pl.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-ink">{socio?.nome ?? "Sócio"}</p>
                  <p className="text-xs text-muted">
                    {new Date(pl.data_pagamento + "T00:00:00").toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <span className="font-mono tabular text-sm text-ink">{formatBRL(Number(pl.valor))}</span>
              </div>
            );
          })}
          {!loading && proLabores.length === 0 && (
            <p className="px-5 py-6 text-sm text-muted">
              Nenhum pró-labore registrado ainda. Cada registro já entra automaticamente no Custo do Mês.
            </p>
          )}
        </div>
      </div>

      {/* Distribuições */}
      <div className="bg-white rounded-md shadow-sm">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <p className="text-sm font-medium text-ink">Distribuições de dividendos</p>
          <button
            onClick={() => setShowDistForm((s) => !s)}
            disabled={socios.length === 0}
            className="text-xs font-medium text-ledger-dark hover:underline disabled:opacity-40"
          >
            {showDistForm ? "Cancelar" : "+ Nova distribuição"}
          </button>
        </div>

        {showDistForm && (
          <form onSubmit={handleDistribuir} className="px-5 py-4 border-b border-line flex flex-col md:flex-row gap-3">
            <input
              required
              type="month"
              value={novaDistribuicao.mes}
              onChange={(e) => setNovaDistribuicao({ ...novaDistribuicao, mes: e.target.value })}
              className="px-3 py-2.5 rounded-md border border-line text-sm"
            />
            <input
              required
              type="number"
              step="0.01"
              placeholder="Lucro a distribuir (R$)"
              value={novaDistribuicao.lucro}
              onChange={(e) => setNovaDistribuicao({ ...novaDistribuicao, lucro: e.target.value })}
              className="flex-1 px-3 py-2.5 rounded-md border border-line text-sm font-mono"
            />
            <button
              disabled={saving}
              type="submit"
              className="bg-ledger text-white text-sm font-medium px-4 py-2.5 rounded-md hover:bg-ledger-dark transition-colors disabled:opacity-60"
            >
              Calcular e distribuir
            </button>
          </form>
        )}

        <div className="divide-y divide-line">
          {distribuicoes.map((d) => (
            <div key={d.id} className="px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-ink capitalize">
                  {new Date(d.mes_referencia + "T00:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                </p>
                <span className="font-mono tabular text-sm text-ink">{formatBRL(Number(d.lucro_distribuivel))}</span>
              </div>
              <div className="space-y-1.5">
                {d.dividendos_socios.map((ds) => {
                  const socio = socios.find((s) => s.id === ds.socio_id);
                  return (
                    <div key={ds.id} className="flex items-center justify-between text-sm pl-3">
                      <span className="text-muted">{socio?.nome ?? "Sócio"}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono tabular text-ink">{formatBRL(Number(ds.valor))}</span>
                        <button
                          onClick={() => togglePago(ds.id, ds.pago)}
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            ds.pago ? "bg-ledger-soft text-ledger-dark" : "bg-amber-soft text-amber"
                          }`}
                        >
                          {ds.pago ? "Pago" : "Pendente"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {!loading && distribuicoes.length === 0 && (
            <p className="px-5 py-6 text-sm text-muted">Nenhuma distribuição registrada ainda.</p>
          )}
        </div>
      </div>
    </div>
  );
}
