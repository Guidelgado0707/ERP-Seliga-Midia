"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
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
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const mobileNavRef = useRef<HTMLElement>(null);
  const activeItemRef = useRef<HTMLAnchorElement>(null);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  // garante que a aba ativa fique visível dentro da barra rolável (ex: ao navegar
  // direto para "Contratos", que sem isso ficaria fora da área visível inicial)
  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  return (
    <>
      {/* Desktop: sidebar fixa à esquerda */}
      <aside className="hidden md:flex md:flex-col md:w-60 md:fixed md:inset-y-0 border-r border-line bg-white">
        <div className="px-6 py-6 border-b border-line flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-seliga-midia.png" alt="Seliga Mídia" className="h-10 w-10 object-contain shrink-0" />
          <div className="min-w-0">
            <p className="font-display font-semibold text-lg tracking-tight text-ink leading-tight">Seliga Mídia</p>
            <p className="text-xs text-muted">Gestão financeira</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? "bg-ledger-soft text-ledger-dark"
                    : "text-muted hover:bg-paper hover:text-ink"
                }`}
              >
                <span className="w-4 text-center">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-4 border-t border-line space-y-1">
          <Link
            href="/seguranca"
            prefetch={false}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
              pathname.startsWith("/seguranca")
                ? "bg-ledger-soft text-ledger-dark"
                : "text-muted hover:bg-paper hover:text-ink"
            }`}
          >
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
      </aside>

      {/* Mobile: barra inferior fixa. Com 10 abas não cabem todas na tela, então
          rola horizontalmente (arrastando) em vez de cortar as últimas fora de vista */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-line">
        <nav
          ref={mobileNavRef}
          className="flex overflow-x-auto no-scrollbar px-1 py-2 scroll-smooth"
        >
          {ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                ref={active ? activeItemRef : undefined}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-md text-[11px] font-medium shrink-0 ${
                  active ? "text-ledger-dark" : "text-muted"
                }`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        {/* fades nas bordas: sinalizam que dá pra arrastar pra ver as outras abas */}
        <div className="absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-white to-transparent pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white to-transparent pointer-events-none" />
      </div>
    </>
  );
}
