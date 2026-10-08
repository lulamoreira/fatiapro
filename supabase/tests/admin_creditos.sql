-- admin_dar_creditos / admin_remover_creditos regression test. Rolls back.
begin;
do $$
declare u uuid := gen_random_uuid(); a uuid := gen_random_uuid(); l_cedo uuid; l_tarde uuid; ok boolean;
begin
  l_cedo := admin_dar_creditos(u, 5, 'cortesia', 10, 'suporte', a);
  l_tarde := admin_dar_creditos(u, 5, 'ajuste', 300, 'correção', a);
  if saldo_creditos(u) <> 10 then raise exception 'dar créditos falhou'; end if;
  if (select tipo from creditos_movimentos where lote_id = l_tarde) <> 'ajuste' then raise exception 'origem ajuste devia gerar movimento ajuste'; end if;
  if (select admin_id from creditos_movimentos where lote_id = l_cedo) <> a then raise exception 'admin_id não gravado'; end if;

  -- motivo obrigatório
  ok := false; begin perform admin_dar_creditos(u, 1, 'cortesia', 10, 'ab', a); exception when others then ok := sqlerrm = 'motivo_obrigatorio'; end;
  if not ok then raise exception 'dar sem motivo devia falhar'; end if;
  ok := false; begin perform admin_remover_creditos(u, 1, '  ', a); exception when others then ok := sqlerrm = 'motivo_obrigatorio'; end;
  if not ok then raise exception 'remover sem motivo devia falhar'; end if;

  -- saldo insuficiente
  ok := false; begin perform admin_remover_creditos(u, 11, 'teste', a); exception when others then ok := sqlerrm = 'saldo_insuficiente'; end;
  if not ok then raise exception 'esperava saldo_insuficiente'; end if;

  -- remove from the lot that expires LAST first
  perform admin_remover_creditos(u, 6, 'teste', a);
  if (select restante from creditos_lotes where id = l_tarde) <> 0 then raise exception 'devia tirar primeiro do lote que vence por último'; end if;
  if (select restante from creditos_lotes where id = l_cedo) <> 4 then raise exception 'devia tirar 1 do outro lote'; end if;
  if (select count(*) from creditos_movimentos where user_id = u and tipo = 'ajuste' and quantidade < 0) <> 2 then raise exception 'um movimento por lote'; end if;

  raise exception 'OK_TESTES_PASSARAM';
end $$;
rollback;
