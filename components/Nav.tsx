"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

const ITEMS = [
  { href: "/dashboard", label: "Painel", icon: "◧" },
  { href: "/dre", label: "DRE", icon: "▦" },
  { href: "/contas-a-pagar", label: "A Pagar", icon: "↑" },
  { href: "/contas-a-receber", label: "A Receber", icon: "↓" },
  { href: "/projeto-jc", label: "Projeto JC", icon: "⊙" },
  { href: "/notas", label: "Notas", icon: "▤" },
  { href: "/socios", label: "Sócios", icon: "◍" },
  { href: "/propostas", label: "Propostas", icon: "◈" },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Desktop: sidebar fixa à esquerda */}
      <aside className="hidden md:flex md:flex-col md:w-60 md:fixed md:inset-y-0 border-r border-line bg-white">
        <div className="px-6 py-6 border-b border-line">
          <p className="font-display font-semibold text-lg tracking-tight text-ink">Gestão Seliga Mídia</p>
          <p className="text-xs text-muted mt-0.5">Gestão financeira</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
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
        <div className="px-3 py-4 border-t border-line">
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2.5 rounded-md text-sm font-medium text-muted hover:bg-paper hover:text-crimson transition-colors"
          >
            Sair
          </button>
        </div>
      </aside>

      {/* Mobile: barra inferior fixa, fácil de usar com o polegar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-line flex justify-around py-2 z-50">
        {ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-md text-[11px] font-medium ${
                active ? "text-ledger-dark" : "text-muted"
              }`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
