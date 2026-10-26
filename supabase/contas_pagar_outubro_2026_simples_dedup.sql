-- CONTAS A PAGAR — Outubro/2026: consolida a duplicata do Simples Nacional.
-- Havia 2 linhas pro mesmo pagamento: "Simples Nacional" R$ 20.000 (conta lançada no começo do mês,
-- marcada paga na mão, sem banco_referencia) e "Pix enviado para RECEITA FEDERAL" R$ 19.833,22
-- (avulso da Conciliação, de 19/10). Resultado: Impostos de outubro saía ~R$ 40,4 mil na DRE.
-- Mantém a linha "Simples Nacional" com o valor realmente pago (R$ 19.833,22) e a referência do
-- banco, e apaga o avulso (delete antes do update por causa do UNIQUE em banco_referencia).
-- Resultado esperado: Impostos de outubro = R$ 20.368,15 (19.833,22 + INSS+CIM 534,93).
-- "select ... strict" aborta sem mexer em nada se não achar exatamente 1 linha de cada.
do $$
declare
  v_avulso uuid; v_simples uuid;
  v_ref text; v_data date; v_em timestamptz;
begin
  select id into strict v_avulso from contas_pagar
   where origem = 'seliga_midia' and status = 'pago'
     and descricao = 'Pix enviado para RECEITA FEDERAL' and valor = 19833.22
     and data_pagamento = '2026-10-19' and banco_referencia is not null;

  select id into strict v_simples from contas_pagar
   where origem = 'seliga_midia' and status = 'pago'
     and descricao = 'Simples Nacional' and valor = 20000.00
     and data_vencimento = '2026-10-20' and banco_referencia is null;

  select banco_referencia, data_pagamento, pago_em into v_ref, v_data, v_em
    from contas_pagar where id = v_avulso;

  delete from contas_pagar where id = v_avulso;

  update contas_pagar
     set valor = 19833.22,
         data_pagamento = v_data, pago_em = v_em, banco_referencia = v_ref,
         observacoes = 'Pago via Pix 19/10 (R$ 19.833,22). Valor estimado era R$ 20.000,00.'
   where id = v_simples;
end $$;
