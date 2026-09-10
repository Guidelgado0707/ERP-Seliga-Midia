import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase com service_role (bypassa RLS). USAR APENAS EM ROTAS
 * DE API DO SERVIDOR. Nunca importar isso em código que roda no browser
 * — a chave é sensível.
 *
 * Usado principalmente pelas rotas de PIX, onde as tabelas propositalmente
 * não têm policy de INSERT/UPDATE pro cliente (defesa em profundidade — só
 * o backend pode gravar em pix_solicitacoes, pix_auditoria, etc.).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não configurado no servidor. Peça pro admin configurar no Vercel.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
