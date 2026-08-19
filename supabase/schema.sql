-- ============================================================
-- AGENCIA ERP - Schema inicial (Supabase / Postgres)
-- Rode este arquivo inteiro no SQL Editor do seu projeto Supabase
-- ============================================================

-- Extensão para gerar UUID
create extension if not exists "pgcrypto";

-- ---------- CATEGORIAS (pra organizar pagar/receber) ----------
create table categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null check (tipo in ('pagar', 'receber', 'ambos')),
  -- só relevante pra categorias de despesa (pagar/ambos); usado na DRE pro
  -- ponto de equilíbrio e margem de contribuição. null = tratado como variável.
  tipo_custo text check (tipo_custo in ('fixo', 'variavel')),
  created_at timestamptz not null default now()
);

-- ---------- CONTAS A PAGAR ----------
create table contas_pagar (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  fornecedor text,
  categoria_id uuid references categorias(id),
  valor numeric(12,2) not null,
  data_vencimento date not null,
  data_pagamento date,
  pago_em timestamptz, -- momento exato em que foi marcado como pago (pra calcular o Caixa certinho)
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'atrasado', 'cancelado')),
  forma_pagamento text,
  observacoes text,
  nota_fiscal_url text,
  -- 'seliga_midia' = operação principal (aparece em Contas a Pagar/DRE/Painel normalmente).
  -- 'projeto_jc' = operação separada que compartilha a mesma conta corrente (aba Projeto JC;
  -- entra no saldo do Caixa mas fica fora do Contas a Pagar e da DRE da Seliga Mídia).
  origem text not null default 'seliga_midia' check (origem in ('seliga_midia', 'projeto_jc')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid()
);

-- ---------- CONTAS A RECEBER ----------
create table contas_receber (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  cliente text not null,
  categoria_id uuid references categorias(id),
  valor numeric(12,2) not null,
  data_vencimento date not null,
  data_recebimento date,
  recebido_em timestamptz, -- momento exato em que foi marcado como recebido (pra calcular o Caixa certinho)
  status text not null default 'pendente' check (status in ('pendente', 'recebido', 'atrasado', 'cancelado')),
  gera_credito_cliente boolean not null default false,
  -- dinheiro que entra mas não é faturamento de cliente (ex: reembolso de gasto que caiu no
  -- cartão da empresa) — conta no Caixa, mas fica fora do Faturamento/DRE.
  reembolso boolean not null default false,
  observacoes text,
  nota_fiscal_url text,
  origem text not null default 'seliga_midia' check (origem in ('seliga_midia', 'projeto_jc')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid()
);

-- ---------- SÓCIOS ----------
create table socios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  percentual_participacao numeric(5,2) not null check (percentual_participacao >= 0 and percentual_participacao <= 100),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- DISTRIBUIÇÃO DE DIVIDENDOS ----------
create table dividendos (
  id uuid primary key default gen_random_uuid(),
  mes_referencia date not null, -- guarde sempre como primeiro dia do mês, ex: 2026-08-01
  lucro_distribuivel numeric(12,2) not null,
  data_distribuicao date,
  observacoes text,
  created_at timestamptz not null default now()
);

create table dividendos_socios (
  id uuid primary key default gen_random_uuid(),
  dividendo_id uuid references dividendos(id) on delete cascade,
  socio_id uuid references socios(id),
  valor numeric(12,2) not null,
  pago boolean not null default false,
  data_pagamento date,
  pago_em timestamptz -- momento exato do pagamento, pra calcular o Caixa certinho (não entra na DRE)
);

-- ---------- PRÓ-LABORE (retirada dos sócios) ----------
-- Registrado aqui em vez de Contas a Pagar direto; ao salvar, lança
-- automaticamente uma linha em contas_pagar (já paga) pra contar no Custo do Mês.
create table pro_labore (
  id uuid primary key default gen_random_uuid(),
  socio_id uuid references socios(id),
  valor numeric(12,2) not null,
  data_vencimento date not null, -- quando deve/deveria ser pago
  data_pagamento date, -- preenchido só quando efetivamente pago
  pago_em timestamptz, -- momento exato do pagamento, pro cálculo do Caixa
  status text not null default 'pago' check (status in ('pendente', 'pago')),
  conta_pagar_id uuid references contas_pagar(id),
  observacoes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid()
);

-- ---------- FATURAS IMPORTADAS (upload + leitura por IA) ----------
create table faturas_importadas (
  id uuid primary key default gen_random_uuid(),
  forma_pagamento text not null,
  data_pagamento date not null,
  arquivos text[] not null default '{}',
  quantidade_itens integer not null default 0,
  valor_total numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid()
);

-- ---------- PROJETO JC — ajuste manual de lucro líquido por mês ----------
-- O saldo (recebido - pago) do mês é calculado automaticamente, mas às vezes o
-- resultado real difere por acertos internos que não entram como lançamento.
-- Essa tabela guarda um valor manual opcional por mês, sem alterar receita/despesa.
create table projeto_jc_ajustes (
  id uuid primary key default gen_random_uuid(),
  mes text not null unique, -- formato 'YYYY-MM'
  lucro_liquido numeric(12,2) not null,
  observacoes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid()
);

-- ---------- CAIXA (ponto de referência pra calcular o saldo atual) ----------
-- O saldo "agora" = valor mais recente aqui + tudo recebido/pago desde data_referencia.
-- Recalibre sempre que quiser conferir contra o extrato bancário real.
create table caixa_referencia (
  id uuid primary key default gen_random_uuid(),
  -- "Conta Corrente": some/soma sozinha com contas a receber/pagar desde data_referencia.
  -- "Reserva de Emergência": fica parada, só muda quando você registra um novo ajuste manual.
  conta text not null default 'Conta Corrente'
    check (conta in ('Conta Corrente', 'Reserva de Emergência')),
  data_referencia date not null,
  valor numeric(12,2) not null,
  observacoes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid()
);

-- ---------- PROPOSTAS COMERCIAIS (Girando na Alta) ----------
create table propostas (
  id uuid primary key default gen_random_uuid(),
  empresa text not null,
  criador text not null default 'Girando na Alta'
    check (criador in ('Girando na Alta', 'Lucas Feitoza', 'Seliga Mídia')),
  meses integer not null default 3,
  quantidade_videos integer not null,
  valor_unitario numeric(12,2) not null,
  resumo text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid()
);

-- ---------- CONTRATOS DE PARCERIA COMERCIAL (contrato pontual, vídeo único ou N vídeos) ----------
-- Contratada é sempre a Seliga Mídia LTDA (dados fixos no componente do documento);
-- "criador" só define qual perfil/criador aparece vinculado ao contrato.
create table contratos (
  id uuid primary key default gen_random_uuid(),
  contratante_razao_social text not null,
  contratante_cnpj text not null,
  contratante_endereco text not null,
  contratante_representante text not null,
  contratante_email text not null,
  criador text not null default 'pedro' check (criador in ('pedro', 'andre', 'lucas')),
  quantidade_videos integer not null default 1,
  valor_por_video numeric(12,2) not null,
  -- prazo de entrega: 'dias' (contrato pontual, ex: 7 dias corridos) ou
  -- 'meses' (contrato recorrente, ex: 9 vídeos em 3 meses = cadência de 3/mês)
  prazo_tipo text not null default 'dias' check (prazo_tipo in ('dias', 'meses')),
  prazo_quantidade integer not null default 7,
  data_contrato date not null,
  testemunha1_nome text not null,
  testemunha1_cpf text not null,
  testemunha2_nome text,
  testemunha2_cpf text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid()
);

-- ---------- VÍDEOS (agenda de edição/entrega — espelha a planilha "AGENDA DE EDIÇÃO") ----------
create table videos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cliente text not null,
  status text not null default 'editado' check (status in ('editado', 'nao_editado')),
  data date not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid()
);

-- ---------- NOTAS FISCAIS / RECIBOS AVULSOS (upload pelo celular) ----------
-- Usada pro fluxo "tirei foto da nota do almoço e joguei no app"
create table notas_fiscais (
  id uuid primary key default gen_random_uuid(),
  arquivo_url text not null,
  descricao text,
  valor numeric(12,2),
  data_nota date,
  status text not null default 'pendente_categorizacao'
    check (status in ('pendente_categorizacao', 'vinculada', 'ignorada')),
  conta_pagar_id uuid references contas_pagar(id),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid()
);

-- ============================================================
-- SEGURANÇA: Row Level Security (RLS)
-- Por enquanto é só você usando o sistema, então a regra é simples:
-- "qualquer usuário autenticado no seu projeto pode ler/escrever".
-- Quando os sócios entrarem, a gente refina pra permissões por papel.
-- ============================================================

alter table categorias enable row level security;
alter table contas_pagar enable row level security;
alter table contas_receber enable row level security;
alter table socios enable row level security;
alter table dividendos enable row level security;
alter table dividendos_socios enable row level security;
alter table notas_fiscais enable row level security;
alter table pro_labore enable row level security;
alter table propostas enable row level security;
alter table contratos enable row level security;
alter table caixa_referencia enable row level security;
alter table projeto_jc_ajustes enable row level security;
alter table faturas_importadas enable row level security;
alter table videos enable row level security;

create policy "authenticated_full_access" on categorias
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access" on contas_pagar
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access" on contas_receber
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access" on socios
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access" on dividendos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access" on dividendos_socios
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access" on notas_fiscais
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access" on pro_labore
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access" on propostas
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access" on contratos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access" on caixa_referencia
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access" on projeto_jc_ajustes
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access" on faturas_importadas
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access" on videos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ============================================================
-- STORAGE: bucket para as fotos de nota fiscal enviadas pelo celular
-- ============================================================
insert into storage.buckets (id, name, public)
values ('notas-fiscais', 'notas-fiscais', false)
on conflict (id) do nothing;

create policy "authenticated_upload_notas" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'notas-fiscais');

create policy "authenticated_read_notas" on storage.objects
  for select to authenticated
  using (bucket_id = 'notas-fiscais');

-- ============================================================
-- STORAGE: bucket para as fotos/PDFs de fatura de cartão enviadas
-- ============================================================
insert into storage.buckets (id, name, public)
values ('faturas', 'faturas', false)
on conflict (id) do nothing;

create policy "authenticated_upload_faturas" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'faturas');

create policy "authenticated_read_faturas" on storage.objects
  for select to authenticated
  using (bucket_id = 'faturas');

-- Categorias iniciais sugeridas (edite/complete como quiser)
insert into categorias (nome, tipo) values
  ('Serviços de Marketing', 'receber'),
  ('Consultoria', 'receber'),
  ('Salários e Pró-labore', 'pagar'),
  ('Ferramentas e Software', 'pagar'),
  ('Alimentação', 'pagar'),
  ('Impostos', 'pagar'),
  ('Aluguel e Infraestrutura', 'pagar'),
  ('Fornecedores/Freelancers', 'pagar');
