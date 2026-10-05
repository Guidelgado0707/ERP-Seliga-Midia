-- CONTAS A PAGAR — Outubro/2026 (Seliga Mídia) — despesas/custos fixos da planilha.
-- Planilha: R$ 47.327,82. Aqui entram 8 itens = R$ 29.327,82, porque ficam de fora:
--   • Pró-labore (18.000): lançar pela tela de Sócios (ela cria o pró-labore por sócio e a conta a pagar
--     juntos; lançar aqui duplicaria na DRE/Sócios).
--   • Cartão de Crédito (0,00): sem valor.
-- Todas PENDENTES, vencimento 2026-10-05 (ajuste na tela, ex: Simples costuma vencer dia 20).
-- Cartão C6 aparece como PAGO na planilha, mas entra pendente pra a Conciliação do banco dar a baixa.
-- Simples e INSS+CIM em "Impostos". Idempotente (não duplica se rodar 2x).
begin;

insert into categorias (nome, tipo, tipo_custo)
select 'Impostos', 'pagar', 'variavel'
where not exists (select 1 from categorias where nome = 'Impostos');

insert into contas_pagar (descricao, valor, data_vencimento, status, origem, categoria_id)
select v.descricao, v.valor, '2026-10-05', 'pendente', 'seliga_midia', v.categoria_id
from (values
  ('Aluguel',                        1253.87,  null::uuid),
  ('Energia',                        180.00,   null),
  ('Telefone fixo, móvel e internet', 108.77,  null),
  ('Contador',                       425.00,   null),
  ('Salário Pedro',                  2500.00,  null),
  ('Cartão C6',                      4325.25,  null),
  ('Simples Nacional',               20000.00, (select id from categorias where nome = 'Impostos' order by created_at limit 1)),
  ('INSS + CIM',                     534.93,   (select id from categorias where nome = 'Impostos' order by created_at limit 1))
) as v(descricao, valor, categoria_id)
where not exists (
  select 1 from contas_pagar c
  where c.descricao = v.descricao
    and c.valor = v.valor
    and c.data_vencimento = '2026-10-05'
    and c.origem = 'seliga_midia'
);

-- conferência: deve dar 8 itens e 29327.82 (sem o pró-labore de 18.000)
select count(*) as itens, sum(valor) as total
from contas_pagar
where origem = 'seliga_midia' and data_vencimento = '2026-10-05'
  and descricao in ('Aluguel','Energia','Telefone fixo, móvel e internet','Contador','Salário Pedro','Cartão C6','Simples Nacional','INSS + CIM');

commit;
