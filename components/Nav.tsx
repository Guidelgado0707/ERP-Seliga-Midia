"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

const ITEMS = [
  { href: "/dashboard", label: "Painel", icon: "◧" },
  { href: "/dre", label: "DRE", icon: "▦" },
  { href: "/contas-a-pagar", label: "A Pagar", icon: "↑" },
  { href: "/contas-a-receber", label: "A Receber", icon: "↓" },
  { href: "/banco", label: "Banco C6", icon: "🏦" },
  { href: "/projeto-jc", label: "Projeto JC", icon: "⊙" },
  { href: "/notas", label: "Notas", icon: "▤" },
  { href: "/faturas", label: "Faturas", icon: "✨" },
  { href: "/videos", label: "Vídeos", icon: "▶" },
  { href: "/socios", label: "Sócios", icon: "◍" },
  { href: "/propostas", label: "Propostas", icon: "◈" },
  { href: "/contratos", label: "Contratos", icon: "▧" },
  { href: "/auditoria", label: "Auditoria", icon: "🛡️" },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  // fecha o menu lateral ao navegar pra outra página
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // trava o scroll do fundo enquanto o menu mobile está aberto
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function itemClass(href: string) {
    const active = pathname.startsWith(href);
    return `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
      active ? "bg-ledger-soft text-ledger-dark" : "text-muted hover:bg-paper hover:text-ink"
    }`;
  }

  // conteúdo do menu (reaproveitado no desktop e no drawer mobile)
  const menu = (
    <>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {ITEMS.map((item) => (
          <Link key={item.href} href={item.href} prefetch={false} className={itemClass(item.href)}>
            <span className="w-4 text-center">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-line space-y-1">
        <Link href="/seguranca" prefetch={false} className={itemClass("/seguranca")}>
          <span className="w-4 text-center">🔐</span>
          Segurança
        </Link>
        <button
          onClick={handleLogout}
          className="w-full text-left px-3 py-2.5 rounded-md text-sm font-medium text-muted hover:bg-paper hover:text-crimson transition-colors"
        >
          Sair
        </button>
      </div>
    </>
  );

  const header = (
    <div className="px-6 py-6 border-b border-line flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-seliga-midia.png" alt="Seliga Mídia" className="h-10 w-10 object-contain shrink-0" />
      <div className="min-w-0">
        <p className="font-display font-semibold text-lg tracking-tight text-ink leading-tight">Seliga Mídia</p>
        <p className="text-xs text-muted">Gestão financeira</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: sidebar fixa à esquerda */}
      <aside className="hidden md:flex md:flex-col md:w-60 md:fixed md:inset-y-0 border-r border-line bg-white">
        {header}
        {menu}
      </aside>

      {/* Mobile: barra de topo com botão de menu */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 h-14 bg-white border-b border-line flex items-center gap-3 px-4">
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          className="p-1.5 -ml-1.5 rounded-md text-ink hover:bg-paper transition-colors"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-seliga-midia.png" alt="Seliga Mídia" className="h-7 w-7 object-contain" />
        <span className="font-display font-semibold text-ink">Seliga Mídia</span>
      </div>

      {/* Mobile: fundo escurecido atrás do menu */}
      <div
        onClick={() => setOpen(false)}
        className={`md:hidden fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Mobile: menu lateral que desliza da esquerda */}
      <aside
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[82%] bg-white border-r border-line flex flex-col shadow-xl transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-5 py-5 border-b border-line flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-seliga-midia.png" alt="Seliga Mídia" className="h-9 w-9 object-contain shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-display font-semibold text-base tracking-tight text-ink leading-tight">Seliga Mídia</p>
            <p className="text-xs text-muted">Gestão financeira</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
            className="p-1.5 rounded-md text-muted hover:bg-paper hover:text-ink transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>
        {menu}
      </aside>
    </>
  );
}
