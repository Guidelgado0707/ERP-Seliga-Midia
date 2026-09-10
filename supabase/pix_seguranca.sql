-- ==============================================================================
--  PIX real (envio de dinheiro) — infraestrutura de segurança (Fase 1)
--  ---------------------------------------------------------------------------
--  6 regras acordadas (ver memória erp-seliga-midia-seguranca-pix):
--  1. Limite por transação e por dia (server-side)
--  2. Destinatários pré-cadastrados
--  3. Aprovação dupla acima de valor combinado (maker-checker)
--  4. Confirmação extra no envio (PIN)                     ← código, não tabela
--  5. Notificação automática (WhatsApp via Z-API)          ← código, não tabela
--  6. Log de auditoria (append-only)
--
--  Limites acordados na sessão de 2026-09-10:
--    - Por transação: R$ 1.000
--    - Por dia: R$ 20.000
--    - Acima de R$ 1.000 exige aprovação de outro sócio
-- ==============================================================================
begin;

-- ---------- 1. Destinatários pré-cadastrados ----------
create table if not exists pix_destinatarios (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,            -- ex: "Cartão Azul Itaú", "Contador João"
  chave          text not null,            -- a chave PIX (CPF/CNPJ/email/telefone/aleatória)
  tipo           text not null             -- classificação da chave
    check (tipo in ('cpf','cnpj','email','telefone','aleatoria')),
  observacao     text,
  ativo          boolean not null default true,
  cadastrado_por uuid not null references auth.users(id),
  cadastrado_em  timestamptz not null default now(),
  desativado_por uuid references auth.users(id),
  desativado_em  timestamptz,
  unique (chave)
);

-- ---------- 2. Solicitações de envio (estado da máquina de estados) ----------
create table if not exists pix_solicitacoes (
  id                uuid primary key default gen_random_uuid(),
  destinatario_id   uuid not null references pix_destinatarios(id),
  valor             numeric(12,2) not null check (valor > 0),
  descricao         text,                                    -- motivo do envio, aparece no auditoria
  status            text not null default 'pendente_aprovacao'
    check (status in ('pendente_aprovacao','aprovada','enviada','falhou','cancelada')),
  pedido_por        uuid not null references auth.users(id),
  pedido_em         timestamptz not null default now(),
  aprovado_por      uuid references auth.users(id),
  aprovado_em       timestamptz,
  enviado_em        timestamptz,
  end_to_end_id     text,                                    -- id devolvido pelo C6 depois de enviado
  resposta_c6       jsonb,                                   -- payload de resposta pra debug
  erro              text,
  -- constraint crítica: quem pediu não pode ser quem aprovou
  constraint chk_maker_checker check (aprovado_por is null or aprovado_por <> pedido_por)
);
create index if not exists idx_pix_sol_status on pix_solicitacoes(status);
create index if not exists idx_pix_sol_dia    on pix_solicitacoes(pedido_em);

-- ---------- 3. Auditoria append-only ----------
create table if not exists pix_auditoria (
  id             uuid primary key default gen_random_uuid(),
  solicitacao_id uuid references pix_solicitacoes(id) on delete set null,
  acao           text not null,           -- 'criada','aprovada','enviada','falhou','cancelada'
  ator           uuid references auth.users(id),
  em             timestamptz not null default now(),
  detalhes       jsonb                    -- snapshot dos campos relevantes
);
create index if not exists idx_pix_audit_sol on pix_auditoria(solicitacao_id);

-- ---------- 4. Configuração dos limites (uma linha só) ----------
create table if not exists pix_limites (
  id                        int primary key default 1,
  limite_por_transacao      numeric(12,2) not null default 1000.00,
  limite_por_dia            numeric(12,2) not null default 20000.00,
  valor_requer_aprovacao    numeric(12,2) not null default 1000.00,
  updated_at                timestamptz not null default now(),
  constraint apenas_uma check (id = 1)
);
insert into pix_limites (id) values (1) on conflict (id) do nothing;

-- ==============================================================================
-- Row Level Security
-- ==============================================================================
alter table pix_destinatarios enable row level security;
alter table pix_solicitacoes  enable row level security;
alter table pix_auditoria     enable row level security;
alter table pix_limites       enable row level security;

-- Destinatários: qualquer sócio autenticado lê/escreve (só 3 pessoas têm login)
drop policy if exists "pix_dest_full" on pix_destinatarios;
create policy "pix_dest_full" on pix_destinatarios
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Solicitações: leitura livre pra autenticados; INSERT/UPDATE **só via backend**
-- (usaremos a service role no server) — cliente não pode inserir/mudar direto.
drop policy if exists "pix_sol_read"   on pix_solicitacoes;
create policy "pix_sol_read" on pix_solicitacoes
  for select using (auth.role() = 'authenticated');
-- (NÃO criamos policy de INSERT/UPDATE/DELETE — bloqueia clientes;
--  service role no servidor bypassa RLS e faz as escritas.)

-- Auditoria: leitura livre pra autenticados; INSERT só via backend; UPDATE/DELETE JAMAIS.
drop policy if exists "pix_audit_read" on pix_auditoria;
create policy "pix_audit_read" on pix_auditoria
  for select using (auth.role() = 'authenticated');

-- Limites: leitura livre; escrita só via backend.
drop policy if exists "pix_lim_read" on pix_limites;
create policy "pix_lim_read" on pix_limites
  for select using (auth.role() = 'authenticated');

commit;
