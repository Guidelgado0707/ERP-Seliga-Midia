-- Snapshot do saldo do C6 numa data específica. Uma linha só (id=1).
-- Usado pra calcular saldo atual: (saldo_ref) + sum(entradas C6 desde data_ref) − sum(saídas).
-- Se o snapshot ficar defasado (data_ref muito antiga), o cálculo pode ser
-- impreciso — user pode "resetar" atualizando via UI.
begin;

create table if not exists banco_saldo_snapshot (
  id          int primary key default 1,
  saldo_ref   numeric(14,2) not null,
  data_ref    date not null,
  atualizado_em    timestamptz not null default now(),
  atualizado_por   uuid references auth.users(id),
  observacao  text,
  constraint apenas_uma check (id = 1)
);

alter table banco_saldo_snapshot enable row level security;

drop policy if exists "banco_saldo_read" on banco_saldo_snapshot;
create policy "banco_saldo_read" on banco_saldo_snapshot
  for select using (auth.role() = 'authenticated');
-- INSERT/UPDATE só via backend (service_role) — mesmo padrão do PIX

commit;
