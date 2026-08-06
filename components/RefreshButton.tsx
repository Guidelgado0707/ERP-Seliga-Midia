"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export default function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="text-sm font-medium px-3 py-2 rounded-md border border-line text-ink hover:bg-white transition-colors disabled:opacity-60 flex items-center gap-1.5 shrink-0"
    >
      <span className={isPending ? "inline-block animate-spin" : "inline-block"}>↻</span>
      {isPending ? "Atualizando..." : "Atualizar"}
    </button>
  );
}
