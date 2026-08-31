import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname.startsWith("/login");

  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const current = aal?.currentLevel;
    const next = aal?.nextLevel;
    const isSeguranca = request.nextUrl.pathname.startsWith("/seguranca");

    if (current === "aal1" && next === "aal2") {
      // tem 2FA ativado mas a sessão só passou pela senha — precisa completar
      // o desafio do código (a tela de login sabe mostrar esse passo)
      if (!isLoginPage) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        return NextResponse.redirect(url);
      }
    } else if (current === "aal1" && next === "aal1") {
      // 2FA OBRIGATÓRIO: quem ainda não cadastrou fica preso na tela de
      // Segurança até ativar. Libera só /seguranca (e /login) pra não dar loop.
      if (!isSeguranca && !isLoginPage) {
        const url = request.nextUrl.clone();
        url.pathname = "/seguranca";
        return NextResponse.redirect(url);
      }
    } else if (isLoginPage) {
      // sessão completa (aal2) e ainda no login → manda pro painel
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  // exclui _next, api, e qualquer caminho com extensão de arquivo (imagens,
  // manifest.json etc.) — sem isso, arquivos estáticos como a logo ficavam
  // sendo redirecionados pro /login quando deslogado (bug antigo, já
  // corrigido no ERP Açaí-se, replicado aqui do mesmo jeito)
  matcher: ["/((?!_next/static|_next/image|api|.*\\.[\\w]+$).*)"],
};
