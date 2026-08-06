"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabaseClient";
import { StatusBadge } from "@/components/Card";

type Nota = {
  id: string;
  arquivo_url: string;
  descricao: string | null;
  valor: number | null;
  data_nota: string | null;
  status: string;
  created_at: string;
  conta_pagar_id: string | null;
};

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function NotasPage() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ descricao: "", valor: "", data_nota: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("notas_fiscais")
      .select("*")
      .order("created_at", { ascending: false });
    setNotas(data ?? []);

    // gera URLs assinadas (bucket é privado)
    const entries = await Promise.all(
      (data ?? []).map(async (n) => {
        const { data: signed } = await supabase.storage
          .from("notas-fiscais")
          .createSignedUrl(n.arquivo_url, 3600);
        return [n.id, signed?.signedUrl ?? ""] as const;
      })
    );
    setUrls(Object.fromEntries(entries));
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const path = `${user?.id ?? "anon"}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("notas-fiscais").upload(path, file);

    if (!uploadError) {
      await supabase.from("notas_fiscais").insert({
        arquivo_url: path,
        data_nota: new Date().toISOString().slice(0, 10),
      });
      load();
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function startEdit(n: Nota) {
    setEditing(n.id);
    setEditForm({
      descricao: n.descricao ?? "",
      valor: n.valor ? String(n.valor) : "",
      data_nota: n.data_nota ?? "",
    });
  }

  async function saveEdit(id: string) {
    const nota = notas.find((n) => n.id === id);
    const valorNum = editForm.valor ? Number(editForm.valor) : null;
    const dataNota = editForm.data_nota || new Date().toISOString().slice(0, 10);

    let contaPagarId = nota?.conta_pagar_id ?? null;

    // Se tem valor, lança (ou atualiza) automaticamente em Contas a Pagar,
    // já como paga, pra contar no Custo do Mês.
    if (valorNum && valorNum > 0) {
      const contaPagarPayload = {
        descricao: editForm.descricao || "Nota fiscal",
        valor: valorNum,
        data_vencimento: dataNota,
        data_pagamento: dataNota,
        status: "pago",
        nota_fiscal_url: nota?.arquivo_url ?? null,
      };

      if (contaPagarId) {
        await supabase.from("contas_pagar").update(contaPagarPayload).eq("id", contaPagarId);
      } else {
        const { data: novaConta } = await supabase
          .from("contas_pagar")
          .insert(contaPagarPayload)
          .select()
          .single();
        contaPagarId = novaConta?.id ?? null;
      }
    }

    await supabase
      .from("notas_fiscais")
      .update({
        descricao: editForm.descricao,
        valor: valorNum,
        data_nota: editForm.data_nota || null,
        status: "vinculada",
        conta_pagar_id: contaPagarId,
      })
      .eq("id", id);
    setEditing(null);
    load();
  }

  return (
    <div>
      <div className="mb-6">
        <p className="font-display font-semibold text-xl text-ink">Notas Fiscais</p>
        <p className="text-sm text-muted mt-0.5">Tire a foto na hora, categorize depois</p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="w-full bg-ledger text-white text-sm font-medium py-3.5 rounded-md hover:bg-ledger-dark transition-colors disabled:opacity-60 mb-6 flex items-center justify-center gap-2"
      >
        {uploading ? "Enviando..." : "📷 Fotografar / anexar nota"}
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {notas.map((n) => (
          <div key={n.id} className="bg-white rounded-md shadow-sm overflow-hidden">
            {urls[n.id] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={urls[n.id]} alt="Nota fiscal" className="w-full h-40 object-cover bg-line" />
            )}
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <StatusBadge status={n.status} />
                <span className="text-xs text-muted">
                  {new Date(n.created_at).toLocaleDateString("pt-BR")}
                </span>
              </div>

              {editing === n.id ? (
                <div className="space-y-2">
                  <input
                    placeholder="Descrição"
                    value={editForm.descricao}
                    onChange={(e) => setEditForm({ ...editForm, descricao: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-md border border-line text-sm"
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Valor (R$)"
                    value={editForm.valor}
                    onChange={(e) => setEditForm({ ...editForm, valor: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-md border border-line text-sm font-mono"
                  />
                  <input
                    type="date"
                    value={editForm.data_nota}
                    onChange={(e) => setEditForm({ ...editForm, data_nota: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-md border border-line text-sm"
                  />
                  <button
                    onClick={() => saveEdit(n.id)}
                    className="w-full bg-ledger text-white text-xs font-medium py-2 rounded-md hover:bg-ledger-dark"
                  >
                    Salvar
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium text-ink">{n.descricao || "Sem descrição ainda"}</p>
                  <p className="font-mono tabular text-sm text-muted">
                    {n.valor ? formatBRL(Number(n.valor)) : "Valor não informado"}
                  </p>
                  {n.conta_pagar_id && (
                    <p className="text-xs text-ledger-dark mt-0.5">✓ Lançada em Contas a Pagar</p>
                  )}
                  <button
                    onClick={() => startEdit(n)}
                    className="text-xs font-medium text-ledger-dark hover:underline mt-1"
                  >
                    {n.conta_pagar_id ? "Editar categorização" : "Categorizar"}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {!loading && notas.length === 0 && (
        <p className="text-sm text-muted text-center py-10">Nenhuma nota enviada ainda. Toque no botão acima.</p>
      )}
    </div>
  );
}
