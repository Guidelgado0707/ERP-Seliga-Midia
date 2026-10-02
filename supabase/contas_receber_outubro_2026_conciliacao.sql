-- CONTAS A RECEBER — Outubro/2026: consolida Caixa e Autonuntes com os recebimentos já conciliados no banco.
-- Rodar DEPOIS de contas_receber_outubro_2026.sql. Os ids abaixo são das linhas avulsas criadas pela
-- Conciliação (TED 47.500 e PIX Autonunes 6.000); o script apaga o avulso e passa a linha da receita
-- pra 'recebido', herdando a referência do banco (delete antes do update por causa do UNIQUE).
-- Caixa: TED veio líquido (NF 50.000 − 5% retenção = 47.500) → receita reflete o valor líquido.
-- Resultado esperado: 16 itens, R$ 108.049,98.
do $$
declare v_ref text; v_data date; v_em timestamptz;
begin
  -- CAIXA: TED 47.500 (retenção 5%) → fatura vira o valor líquido
  select banco_referencia, data_recebimento, recebido_em into v_ref, v_data, v_em
  from contas_receber where id = 'a3490622-e0bb-443f-aeb0-60645646bfab';
  delete from contas_receber where id = 'a3490622-e0bb-443f-aeb0-60645646bfab';
  update contas_receber
     set valor = 47500.00,
         observacoes = 'NF R$ 50.000,00 − 5% retenção na fonte (R$ 2.500,00)',
         status = 'recebido', data_recebimento = v_data, recebido_em = v_em, banco_referencia = v_ref
   where descricao = 'Caixa' and status = 'pendente'
     and data_vencimento between '2026-10-01' and '2026-10-31' and valor = 50000.00;

  -- AUTONUNTES: PIX 6.000 → fatura 6.000
  select banco_referencia, data_recebimento, recebido_em into v_ref, v_data, v_em
  from contas_receber where id = 'a23f43f4-6a33-4f4d-a21d-d5dcddbd3638';
  delete from contas_receber where id = 'a23f43f4-6a33-4f4d-a21d-d5dcddbd3638';
  update contas_receber
     set status = 'recebido', data_recebimento = v_data, recebido_em = v_em, banco_referencia = v_ref
   where descricao = 'Autonuntes' and status = 'pendente'
     and data_vencimento between '2026-10-01' and '2026-10-31' and valor = 6000.00;
end $$;
