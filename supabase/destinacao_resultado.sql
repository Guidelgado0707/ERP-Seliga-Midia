-- ============================================================
-- DESTINAÇÃO DO RESULTADO — quanto do lucro de cada mês foi guardado
-- como reserva/investimento. NÃO é despesa (não entra na DRE como custo,
-- não reduz o lucro) — é só o registro de pra onde o lucro já apurado foi.
-- Rode INTEIRO no SQL Editor. Idempotente.
-- ============================================================

begin;

create table if not exists destinacao_resultado (
  id uuid primary key default gen_random_uuid(),
  mes text not null unique,           -- 'YYYY-MM'
  reserva numeric(12,2) not null default 0,   -- quanto foi guardado no mês
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  created_by uuid references auth.users(id) default auth.uid()
);

alter table destinacao_resultado enable row level security;

drop policy if exists "authenticated_full_access" on destinacao_resultado;
create policy "authenticated_full_access" on destinacao_resultado
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- entra também no log de auditoria (se a função fn_audit_log já existir)
drop trigger if exists trg_audit_destinacao_resultado on destinacao_resultado;
create trigger trg_audit_destinacao_resultado
  after insert or update or delete on destinacao_resultado
  for each row execute function fn_audit_log();

commit;
