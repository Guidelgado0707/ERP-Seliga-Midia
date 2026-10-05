-- CONTAS A PAGAR — Outubro/2026: ajusta os vencimentos (antes todas em 05/10).
--   Simples Nacional e INSS + CIM → 20/10
--   Aluguel                       → 26/10
--   demais (energia, telefone, contador, salário Pedro, cartão C6) → 30/10
-- Só mexe nas pendentes que ainda estão em 05/10.
update contas_pagar
   set data_vencimento = case
         when descricao in ('Simples Nacional', 'INSS + CIM') then date '2026-10-20'
         when descricao = 'Aluguel'                           then date '2026-10-26'
         else                                                      date '2026-10-30'
       end
 where origem = 'seliga_midia'
   and status = 'pendente'
   and data_vencimento = '2026-10-05'
   and descricao in ('Aluguel', 'Energia', 'Telefone fixo, móvel e internet', 'Contador',
                     'Salário Pedro', 'Cartão C6', 'Simples Nacional', 'INSS + CIM');

-- conferência: deve dar 20/10 → 2 itens (20.534,93) | 26/10 → 1 (1.253,87) | 30/10 → 5 (7.539,02)
select data_vencimento, count(*) as itens, sum(valor) as total
from contas_pagar
where origem = 'seliga_midia'
  and descricao in ('Aluguel', 'Energia', 'Telefone fixo, móvel e internet', 'Contador',
                    'Salário Pedro', 'Cartão C6', 'Simples Nacional', 'INSS + CIM')
  and data_vencimento between '2026-10-01' and '2026-10-31'
group by data_vencimento
order by data_vencimento;
