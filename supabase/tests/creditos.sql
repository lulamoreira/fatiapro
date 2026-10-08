-- Credit rules regression test. Runs inside a transaction and ROLLS BACK (no data kept).
-- Any failed check raises an exception.
begin;
do $$
declare
  u uuid := gen_random_uuid(); u2 uuid := gen_random_uuid();
  d uuid; d2 uuid; l1 uuid; l2 uuid; j uuid; r jsonb; h text := repeat('a', 64);
begin
  insert into devices (user_id, nome, sistema, token_hash, maquina_hash) values (u, 't', 'macos', 'x1', h) returning id into d;
  insert into devices (user_id, nome, sistema, token_hash, maquina_hash) values (u2, 't', 'macos', 'x2', h) returning id into d2;

  -- reservar: consumes the lot that expires first; estorno returns exactly
  insert into creditos_lotes (user_id, origem, quantidade, restante, expira_em) values (u, 'compra', 5, 5, now() + interval '30 days') returning id into l1;
  insert into creditos_lotes (user_id, origem, quantidade, restante, expira_em) values (u, 'compra', 1, 1, now() + interval '1 day') returning id into l2;
  r := criar_analise(u, d, 'reduzir_tempo', null, '{}', 'fatiapro', true, null, null);
  j := (r->>'job_id')::uuid;
  if j is null then raise exception 'esperava job: %', r; end if;
  if (select restante from creditos_lotes where id = l2) <> 0 then raise exception 'devia consumir lote que vence antes'; end if;
  if (select restante from creditos_lotes where id = l1) <> 4 then raise exception 'devia consumir 1 do lote 2'; end if;
  -- trigger: erro before proposta refunds
  update jobs set estado = 'erro' where id = j;
  if saldo_creditos(u) <> 6 or (select creditos_reservados from jobs where id = j) <> 0 then raise exception 'estorno não devolveu exatamente'; end if;
  perform estornar_credito(j); -- idempotent
  if saldo_creditos(u) <> 6 then raise exception 'estorno não idempotente'; end if;
  -- after proposta: no refund
  r := criar_analise(u, d, 'reduzir_tempo', null, '{}', 'fatiapro', false, null, null);
  j := (r->>'job_id')::uuid;
  insert into job_events (job_id, tipo) values (j, 'proposta');
  update jobs set estado = 'cancelado' where id = j;
  if saldo_creditos(u) <> 5 then raise exception 'não devia devolver depois da proposta'; end if;

  -- trial rules (user with no credits)
  update creditos_lotes set restante = 0 where user_id = u;
  insert into testes_gratis (user_id) values (u) on conflict (user_id) do update set inicio = now(), fim = now() + interval '14 days';
  insert into testes_gratis (user_id) values (u2) on conflict (user_id) do update set inicio = now(), fim = now() + interval '14 days';
  r := criar_analise(u, d, 'reduzir_tempo', null, '{}', 'fatiapro', true, null, null);
  if r->>'codigo' <> 'premium_no_teste' then raise exception 'esperava premium_no_teste: %', r; end if;
  r := criar_analise(u, d, 'reduzir_tempo', null, '{}', 'fatiapro', false, null, null);
  j := (r->>'job_id')::uuid;
  if j is null then raise exception 'primeiro teste devia passar: %', r; end if;
  r := criar_analise(u, d, 'reduzir_tempo', null, '{}', 'fatiapro', false, null, null);
  if r->>'codigo' <> 'teste_hoje_usado' then raise exception 'esperava teste_hoje_usado: %', r; end if;
  r := criar_analise(u2, d2, 'reduzir_tempo', null, '{}', 'fatiapro', false, null, null);
  if r->>'codigo' <> 'teste_ja_usado_nesta_maquina' then raise exception 'esperava teste_ja_usado_nesta_maquina: %', r; end if;
  -- questionnaire pending: concluded trial from yesterday without feedback
  update jobs set estado = 'concluido', criado_em = now() - interval '1 day' where id = j;
  r := criar_analise(u, d, 'reduzir_tempo', null, '{}', 'fatiapro', false, null, null);
  if r->>'codigo' <> 'questionario_pendente' or (r->>'job_pendente')::uuid <> j then raise exception 'esperava questionario_pendente: %', r; end if;
  raise notice 'TODOS OS TESTES DE CRÉDITO PASSARAM';
end $$;
rollback;
