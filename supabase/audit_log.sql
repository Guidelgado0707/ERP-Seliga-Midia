-- ============================================================
-- LOG DE AUDITORIA — registra automaticamente quem criou, editou ou
-- apagou qualquer linha nas tabelas financeiras sensíveis.
-- Funciona via trigger no banco, então pega TUDO (app, SQL Editor,
-- import em massa) — não dá pra burlar mudando só o código do app.
-- Rode INTEIRO no SQL Editor do Supabase. Idempotente.
-- ============================================================

begin;

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid,                 -- quem fez (auth.uid() no momento; null = fora do app, ex. import via SQL Editor)
  user_email text,              -- e-mail de quem fez, já resolvido (evita join pra ler o log depois)
  tabela text not null,         -- qual tabela mudou
  registro_id uuid,             -- id da linha alterada
  acao text not null check (acao in ('insert', 'update', 'delete')),
  dados_antes jsonb,            -- estado da linha antes (update/delete)
  dados_depois jsonb            -- estado da linha depois (insert/update)
);

create index if not exists idx_audit_log_tabela on audit_log (tabela, created_at desc);
create index if not exists idx_audit_log_registro on audit_log (registro_id);

alter table audit_log enable row level security;

-- todo mundo autenticado pode LER o log (transparência entre os 3), mas
-- ninguém pode editar/apagar entradas por fora do trigger (nem insert manual)
drop policy if exists "authenticated_read_audit_log" on audit_log;
create policy "authenticated_read_audit_log" on audit_log
  for select to authenticated
  using (true);

-- ---------- função genérica do trigger ----------
create or replace function fn_audit_log() returns trigger as $$
declare
  v_user_id uuid;
  v_user_email text;
begin
  v_user_id := auth.uid();
  select email into v_user_email from auth.users where id = v_user_id;

  insert into audit_log (user_id, user_email, tabela, registro_id, acao, dados_antes, dados_depois)
  values (
    v_user_id,
    v_user_email,
    TG_TABLE_NAME,
    coalesce((case when TG_OP = 'DELETE' then old.id else new.id end), null),
    lower(TG_OP),
    case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when TG_OP in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  return case when TG_OP = 'DELETE' then old else new end;
end;
$$ language plpgsql security definer;

-- ---------- aplica o trigger nas tabelas financeiras sensíveis ----------
-- (fácil estender pra outras tabelas depois: repetir o bloco trocando o nome)

drop trigger if exists trg_audit_contas_pagar on contas_pagar;
create trigger trg_audit_contas_pagar
  after insert or update or delete on contas_pagar
  for each row execute function fn_audit_log();

drop trigger if exists trg_audit_contas_receber on contas_receber;
create trigger trg_audit_contas_receber
  after insert or update or delete on contas_receber
  for each row execute function fn_audit_log();

drop trigger if exists trg_audit_dividendos_socios on dividendos_socios;
create trigger trg_audit_dividendos_socios
  after insert or update or delete on dividendos_socios
  for each row execute function fn_audit_log();

drop trigger if exists trg_audit_pro_labore on pro_labore;
create trigger trg_audit_pro_labore
  after insert or update or delete on pro_labore
  for each row execute function fn_audit_log();

drop trigger if exists trg_audit_caixa_referencia on caixa_referencia;
create trigger trg_audit_caixa_referencia
  after insert or update or delete on caixa_referencia
  for each row execute function fn_audit_log();

commit;
