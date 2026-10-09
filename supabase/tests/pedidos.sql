-- Regression: creditar_pedido is idempotent; estornar_pedido removes only what is left of the order's batch.
-- Ends with an exception so everything rolls back. Expect: 'PEDIDOS_OK'.
DO $$
declare u uuid := gen_random_uuid(); pk uuid; ped uuid; n int; l uuid; r int; ped2 uuid;
begin
  select id into pk from public.pacotes order by ordem limit 1;
  insert into public.pedidos (user_id, pacote_id, creditos, valor_centavos) values (u, pk, 10, 1990) returning id into ped;
  perform public.creditar_pedido(ped, 'pay-1', 'pix');
  perform public.creditar_pedido(ped, 'pay-1', 'pix');
  select count(*) into n from public.creditos_lotes where user_id = u;
  if n <> 1 then raise exception 'FALHA: % lotes', n; end if;
  select lote_id into l from public.pedidos where id = ped;
  update public.creditos_lotes set restante = 4 where id = l;  -- 6 used
  perform public.estornar_pedido(ped, 'teste');
  perform public.estornar_pedido(ped, 'teste');
  select restante into r from public.creditos_lotes where id = l;
  if r <> 0 then raise exception 'FALHA: restante %', r; end if;
  select coalesce(sum(quantidade),0) into n from public.creditos_movimentos where user_id = u and tipo = 'ajuste';
  if n <> -4 then raise exception 'FALHA: ajuste %', n; end if;
  if (select status from public.pedidos where id = ped) <> 'estornado' then raise exception 'FALHA: status'; end if;
  -- other batches untouched
  insert into public.creditos_lotes (user_id, origem, quantidade, restante) values (u, 'cortesia', 5, 5);
  insert into public.pedidos (user_id, pacote_id, creditos, valor_centavos) values (u, pk, 10, 1990) returning id into ped2;
  perform public.creditar_pedido(ped2, 'pay-2', 'pix');
  perform public.estornar_pedido(ped2, 'teste');
  if public.saldo_creditos(u) <> 5 then raise exception 'FALHA: saldo %', public.saldo_creditos(u); end if;
  raise exception 'PEDIDOS_OK';
end $$;
