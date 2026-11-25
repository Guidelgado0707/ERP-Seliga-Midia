-- Proposta: Autoline Honda — treinamento de redes sociais pra equipe de vendas (R$ 10.000,00).
-- Ensinar os vendedores a usar mais as redes sociais pra vender. Criador: Seliga Mídia, tipo "treinamento".
-- Rodar DEPOIS de propostas_tipo_treinamento.sql. O programa do treinamento usa o texto padrão; pra trocar,
-- use o botão Editar na tela de Propostas e escreva o programa no campo de resumo. Idempotente.
insert into propostas (empresa, criador, tipo, meses, opcoes, resumo)
select 'Autoline Honda', 'Seliga Mídia', 'treinamento', 1,
       '[{"titulo":"Treinamento","valor":10000,"detalhe":"Redes sociais para a equipe de vendas"}]'::jsonb,
       null
where not exists (
  select 1 from propostas where empresa = 'Autoline Honda' and tipo = 'treinamento'
);

-- conferência: 1 proposta, R$ 10.000
select empresa, criador, tipo, opcoes from propostas where empresa = 'Autoline Honda' and tipo = 'treinamento';
