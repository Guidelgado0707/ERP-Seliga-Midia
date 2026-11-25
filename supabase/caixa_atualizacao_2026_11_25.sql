-- CAIXA — atualização de 25/11/2026 (Painel > Conta corrente + Reserva de emergência).
--   Conta corrente = o que o C6 mostra na conta: R$ 22.010,29.
--   Reserva de emergência = tudo que está aplicado: R$ 112.000,00
--     (R$ 90.000 em CDI com liquidez diária no Itaú, conta nova + R$ 10.000 na conta Itaú
--      + R$ 12.000 aplicados no C6).
--   Total em caixa = R$ 134.010,29.
-- A conta corrente passa a somar/subtrair sozinha o que for recebido/pago a partir deste momento;
-- a reserva fica parada até um novo ajuste (inclusive o rendimento do CDI, que não entra sozinho).
insert into caixa_referencia (conta, data_referencia, valor, observacoes)
values
  ('Conta Corrente', '2026-11-25', 22010.29,
   'Saldo da conta do C6 em 25/11 (fora os R$ 12.000 aplicados no C6)'),
  ('Reserva de Emergência', '2026-11-25', 112000.00,
   'R$ 90.000 CDI liquidez diária (Itaú, conta nova) + R$ 10.000 conta Itaú + R$ 12.000 aplicados no C6');

-- conferência: Conta Corrente 22010.29 + Reserva 112000.00 = 134010.29
select conta, valor, data_referencia
from (
  select distinct on (conta) conta, valor, data_referencia
  from caixa_referencia
  order by conta, data_referencia desc, created_at desc
) t;
