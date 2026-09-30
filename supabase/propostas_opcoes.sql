-- Propostas: permite várias opções de preço na mesma proposta
-- (ex: "Avulso por vídeo", "Pacote fechado", "Mensal 3 meses"), cada uma
-- com seu próprio valor. Antes a proposta só tinha um preço fixo
-- (quantidade_videos × valor_unitario).
--
-- Rodar uma vez no SQL editor do Supabase.

alter table propostas
  add column if not exists opcoes jsonb not null default '[]'::jsonb;

-- campos antigos viram opcionais: proposta nova usa só "opcoes",
-- proposta antiga continua com esses dois preenchidos (fallback no PDF)
alter table propostas alter column quantidade_videos drop not null;
alter table propostas alter column valor_unitario drop not null;
