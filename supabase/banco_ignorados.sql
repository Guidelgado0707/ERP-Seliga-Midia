-- Conciliação bancária: lançamentos do extrato C6 que o usuário marcou como "Ignorar".
-- Eles somem da lista "Sem conta correspondente" (e da contagem) e NÃO viram conta a pagar/receber.
-- Guarda só a referência do extrato (a mesma usada em banco_referencia) + um resumo pra poder
-- listar/restaurar depois. Rodar uma vez no SQL editor do Supabase.
create table if not exists banco_ignorados (
  banco_referencia text primary key,
  descricao text,
  valor numeric(12,2),
  data date,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid()
);

alter table banco_ignorados enable row level security;

drop policy if exists "authenticated_full_access" on banco_ignorados;
create policy "authenticated_full_access" on banco_ignorados
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
