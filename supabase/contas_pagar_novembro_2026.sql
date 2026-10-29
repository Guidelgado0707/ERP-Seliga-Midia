-- CONTAS A PAGAR — Novembro/2026 (Seliga Mídia) — despesas fixas "no momento" da planilha.
-- Planilha: R$ 29.769,60 (sem pró-labore, que se lança pela tela de Sócios, e sem o Cartão de Crédito, R$ 0,00).
-- Vencimentos no mesmo critério de outubro:
--   Simples Nacional e INSS + CIM → 20/11 | Aluguel → 26/11 | demais → 30/11
--   Salário Pedro dividido em 2 metades de R$ 1.250,00 (15/11 e 30/11), como ele paga — assim a
--   Conciliação casa cada Pix com valor exato, sem criar avulso duplicado.
-- Categorias: Simples e INSS em "Impostos"; Salário Pedro em "Salários e Pró-labore" (custo fixo).
-- Tudo PENDENTE. Idempotente: não duplica linha com a mesma descrição e vencimento em novembro.
begin;

insert into categorias (nome, tipo, tipo_custo)
select 'Impostos', 'pagar', 'variavel'
where not exists (select 1 from categorias where nome = 'Impostos');

insert into categorias (nome, tipo, tipo_custo)
select 'Salários e Pró-labore', 'pagar', 'fixo'
where not exists (select 1 from categorias where nome = 'Salários e Pró-labore');

insert into contas_pagar (descricao, valor, data_vencimento, status, origem, categoria_id)
select v.descricao, v.valor, v.vencimento::date, 'pendente', 'seliga_midia',
       (select id from categorias where nome = v.categoria order by created_at limit 1)
from (values
  ('Aluguel',                                        1253.87,  '2026-11-26', null::text),
  ('Energia',                                        161.21,   '2026-11-30', null),
  ('Telefone fixo, móvel e internet',                108.77,   '2026-11-30', null),
  ('Contador',                                       425.00,   '2026-11-30', null),
  ('Salário Pedro - 1ª metade',                      1250.00,  '2026-11-15', 'Salários e Pró-labore'),
  ('Salário Pedro - 2ª metade',                      1250.00,  '2026-11-30', 'Salários e Pró-labore'),
  ('Passagem Pedrão',                                163.40,   '2026-11-30', null),
  ('Cartão C6',                                      4123.67,  '2026-11-30', null),
  ('Simples Nacional',                               19833.22, '2026-11-20', 'Impostos'),
  ('INSS + CIM',                                     534.93,   '2026-11-20', 'Impostos'),
  ('Verificado Instagram',                           55.00,    '2026-11-30', null),
  ('Espaço Google',                                  40.00,    '2026-11-30', null),
  ('Capcut (Deko)',                                  40.90,    '2026-11-30', null),
  ('Passagem EUA volta (eu e Deko) - parcela 7/10',  529.63,   '2026-11-30', null)
) as v(descricao, valor, vencimento, categoria)
where not exists (
  select 1 from contas_pagar c
  where c.descricao = v.descricao
    and c.data_vencimento = v.vencimento::date
    and c.origem = 'seliga_midia'
);

-- conferência: deve dar 14 itens e 29769.60
select count(*) as itens, sum(valor) as total
from contas_pagar
where origem = 'seliga_midia'
  and data_vencimento between '2026-11-01' and '2026-11-30'
  and descricao in ('Aluguel', 'Energia', 'Telefone fixo, móvel e internet', 'Contador',
                    'Salário Pedro - 1ª metade', 'Salário Pedro - 2ª metade', 'Passagem Pedrão',
                    'Cartão C6', 'Simples Nacional', 'INSS + CIM', 'Verificado Instagram',
                    'Espaço Google', 'Capcut (Deko)', 'Passagem EUA volta (eu e Deko) - parcela 7/10');

commit;
