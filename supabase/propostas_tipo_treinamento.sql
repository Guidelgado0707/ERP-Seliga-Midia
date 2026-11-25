-- Propostas: tipo "treinamento" (ex: treinar vendedores pra usar redes sociais), além do padrão "conteudo"
-- (parceria de vídeos). Mesmo layout do PDF, com texto próprio e sem os blocos de audiência e escopo de vídeo.
-- Rodar uma vez no SQL editor do Supabase.
alter table propostas
  add column if not exists tipo text not null default 'conteudo'
    check (tipo in ('conteudo', 'treinamento'));
