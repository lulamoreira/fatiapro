-- Regression for resgatar_cupom. Ends with an exception so everything rolls back. Expect: 'CUPONS_OK'.
-- Concurrency: resgatar_cupom locks the coupon row (FOR UPDATE) before checking usos < limite_total,
-- so simultaneous redemptions are serialized and cannot exceed the limit.
DO $$
declare u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid(); pk uuid; r jsonb;
begin
  insert into public.cupons (codigo, creditos, limite_total) values ('TESTE-1', 5, 2);
  r := public.resgatar_cupom(u1, ' teste-1 ');
  if (r->>'creditos')::int <> 5 then raise exception 'FALHA minusculas'; end if;
  begin perform public.resgatar_cupom(u1, 'TESTE-1'); raise exception 'FALHA 2x'; exception when others then if sqlerrm <> 'cupom_ja_usado' then raise; end if; end;
  perform public.resgatar_cupom(u2, 'TESTE-1');
  begin perform public.resgatar_cupom(u3, 'TESTE-1'); raise exception 'FALHA limite'; exception when others then if sqlerrm <> 'cupom_esgotado' then raise; end if; end;
  if (select usos from public.cupons where codigo='TESTE-1') <> 2 then raise exception 'FALHA usos'; end if;
  insert into public.cupons (codigo, creditos, inicio, fim) values ('VELHO', 5, now() - interval '10 days', now() - interval '1 day');
  begin perform public.resgatar_cupom(u1, 'VELHO'); raise exception 'FALHA periodo'; exception when others then if sqlerrm <> 'cupom_expirado' then raise; end if; end;
  insert into public.cupons (codigo, creditos, inicio) values ('FUTURO', 5, now() + interval '1 day');
  begin perform public.resgatar_cupom(u1, 'FUTURO'); raise exception 'FALHA futuro'; exception when others then if sqlerrm <> 'cupom_expirado' then raise; end if; end;
  insert into public.cupons (codigo, creditos, so_primeira_compra) values ('PRIMEIRA', 5, true);
  select id into pk from public.pacotes order by ordem limit 1;
  insert into public.pedidos (user_id, pacote_id, creditos, valor_centavos, status) values (u3, pk, 10, 1990, 'aprovado');
  begin perform public.resgatar_cupom(u3, 'PRIMEIRA'); raise exception 'FALHA primeira'; exception when others then if sqlerrm <> 'cupom_so_primeira_compra' then raise; end if; end;
  begin perform public.resgatar_cupom(u1, 'NAOEXISTE'); raise exception 'FALHA invalido'; exception when others then if sqlerrm <> 'cupom_invalido' then raise; end if; end;
  if public.saldo_creditos(u1) <> 5 then raise exception 'FALHA saldo'; end if;
  raise exception 'CUPONS_OK';
end $$;
