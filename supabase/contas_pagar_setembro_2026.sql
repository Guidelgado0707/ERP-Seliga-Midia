-- CONTAS A PAGAR — Setembro/2026 (Seliga Mídia). Todas PENDENTES (a pagar).
-- origem=seliga_midia. data_vencimento padrão 2026-09-05 (ajuste na tela se
-- alguma tiver vencimento específico). Simples e INSS já em "Impostos".
-- Os itens de cartão (fatura do cartão azul, fecha 02/10) NÃO estão aqui —
-- serão destrinchados depois. Idempotente (não duplica se rodar 2x).
begin;

-- garante a categoria Impostos (DRE trata essa categoria de forma especial)
insert into categorias (nome, tipo, tipo_custo)
select 'Impostos', 'pagar', 'variavel'
where not exists (select 1 from categorias where nome = 'Impostos');

-- helper de idempotência: só insere se não existir a mesma descrição+valor+data pendente
insert into contas_pagar (descricao, valor, data_vencimento, status, origem, categoria_id)
select v.descricao, v.valor, '2026-09-05', 'pendente', 'seliga_midia', v.categoria_id
from (values
  ('Energia',                                   180.00,   null::uuid),
  ('Telefone fixo, móvel e internet',           110.00,   null),
  ('Contador',                                  425.00,   null),
  ('Salário Pedro',                             2500.00,  null),
  ('Cartão C6',                                 2471.80,  null),
  ('Simples Nacional',                          15000.00, (select id from categorias where nome = 'Impostos' order by created_at limit 1)),
  ('INSS',                                      543.93,   (select id from categorias where nome = 'Impostos' order by created_at limit 1)),
  ('Verificado Instagram',                      55.00,    null),
  ('Espaço Google',                             40.40,    null),
  ('Capcut (Deko)',                             40.90,    null),
  ('Chat GPT (Deko)',                           99.90,    null),
  ('Passagem EUA volta (eu e Deko) - parcela 5/10', 529.63, null)
) as v(descricao, valor, categoria_id)
where not exists (
  select 1 from contas_pagar c
  where c.descricao = v.descricao
    and c.valor = v.valor
    and c.data_vencimento = '2026-09-05'
    and c.origem = 'seliga_midia'
);

commit;
