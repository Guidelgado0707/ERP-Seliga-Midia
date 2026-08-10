"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

export default function CaixaForm({ onClose }: { onClose: () => void }) {
  const supabase = createClient();
  const router = useRouter();
  const [conta, setConta] = useState<"Conta Corrente" | "Reserva de Emergência">("Conta Corrente");
  const [valor, setValor] = useState("");
  const [dataReferencia, setDataReferencia] = useState(new Date().toISOString().slice(0, 10));
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await supabase.from("caixa_referencia").insert({
      conta,
      data_referencia: dataReferencia,
      valor: Number(valor),
      observacoes: observacoes || null,
    });
    setSaving(false);
    onClose();
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-md shadow-sm p-5 mb-6 grid grid-cols-1 md:grid-cols-4 gap-3"
    >
      <select
        value={conta}
        onChange={(e) => setConta(e.target.value as typeof conta)}
        className="px-3 py-2.5 rounded-md border border-line text-sm"
      >
        <option value="Conta Corrente">Conta Corrente</option>
        <option value="Reserva de Emergência">Reserva de Emergência</option>
      </select>
      <input
        required
        type="number"
        step="0.01"
        placeholder="Valor (R$)"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        className="px-3 py-2.5 rounded-md border border-line text-sm font-mono"
      />
      <input
        required
        type="date"
        value={dataReferencia}
        onChange={(e) => setDataReferencia(e.target.value)}
        className="px-3 py-2.5 rounded-md border border-line text-sm"
      />
      <input
        placeholder="Observação (opcional)"
        value={observacoes}
        onChange={(e) => setObservacoes(e.target.value)}
        className="px-3 py-2.5 rounded-md border border-line text-sm"
      />
      <div className="md:col-span-4 flex gap-2">
        <button
          disabled={saving}
          type="submit"
          className="bg-ledger text-white text-sm font-medium px-4 py-2.5 rounded-md hover:bg-ledger-dark transition-colors disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar saldo"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-sm font-medium px-4 py-2.5 rounded-md border border-line text-ink hover:bg-paper transition-colors"
        >
          Cancelar
        </button>
      </div>
      <p className="md:col-span-4 text-xs text-muted -mt-1">
        <strong>Conta Corrente:</strong> informe o saldo de agora (já incluindo tudo que aconteceu até essa
        data). Dali pra frente, o Painel soma sozinho o que for recebido e subtrai o que for pago.{" "}
        <strong>Reserva de Emergência:</strong> fica parada até você registrar um novo ajuste aqui mesmo (ex:
        quando puxar dinheiro dela por causa de um descasamento de caixa).
      </p>
    </form>
  );
}
