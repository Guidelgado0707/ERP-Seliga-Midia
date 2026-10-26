-- CONTAS A PAGAR — Outubro/2026: Salário Pedro dividido em duas metades de R$ 1.250,00.
-- 1ª metade já paga via Pix em 15/10 (lançada pela Conciliação); a conta "Salário Pedro" de
-- R$ 2.500,00 ficaria duplicada. Deixa a conta pendente só com a 2ª metade (vence 30/10), pra
-- Conciliação casar o Pix final com valor exato, sem criar avulso.
-- "select ... strict" aborta sem mexer em nada se não achar exatamente 1 linha de cada.
do $$
declare v_pix uuid; v_pend uuid;
begin
  select id into strict v_pix from contas_pagar
   where origem = 'seliga_midia' and status = 'pago' and valor = 1250.00
     and descricao like 'Pix enviado para JOAO PEDRO LIRA%'
     and data_pagamento = '2026-10-15';

  select id into strict v_pend from contas_pagar
   where origem = 'seliga_midia' and status = 'pendente' and valor = 2500.00
     and descricao = 'Salário Pedro' and data_vencimento = '2026-10-30';

  update contas_pagar set descricao = 'Salário Pedro - 1ª metade (Pix)' where id = v_pix;

  update contas_pagar
     set valor = 1250.00,
         descricao = 'Salário Pedro - 2ª metade',
         observacoes = 'Salário R$ 2.500,00 dividido: 1ª metade R$ 1.250,00 paga em 15/10; esta é a 2ª.'
   where id = v_pend;
end $$;
