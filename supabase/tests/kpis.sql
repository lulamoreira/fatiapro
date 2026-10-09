-- kpis_admin refuses non-admins; kpis_usuario only counts the caller's rows. Runs in a rolled-back transaction.
BEGIN;
DO $$
DECLARE comum uuid := (SELECT id FROM auth.users u WHERE NOT EXISTS (SELECT 1 FROM app_admins a WHERE a.user_id = u.id) LIMIT 1);
        adm uuid := (SELECT user_id FROM app_admins LIMIT 1);
        ok boolean := false; r jsonb;
BEGIN
  -- no identity
  PERFORM set_config('request.jwt.claims', '{}', true);
  BEGIN PERFORM public.kpis_admin('mes'); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU: sem identidade passou'; END IF;
  -- common user
  IF comum IS NOT NULL THEN
    ok := false;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', comum, 'role', 'authenticated')::text, true);
    BEGIN PERFORM public.kpis_admin('mes'); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
    IF NOT ok THEN RAISE EXCEPTION 'FALHOU: comum passou'; END IF;
  END IF;
  -- admin with bad period / good period
  PERFORM set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  ok := false;
  BEGIN PERFORM public.kpis_admin('ano'); EXCEPTION WHEN invalid_parameter_value THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU: período inválido passou'; END IF;
  r := public.kpis_admin('mes');
  IF r ? 'usuarios_total' IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: admin sem dados'; END IF;
  r := public.kpis_usuario();
  IF (r->>'analises_total')::int <> (SELECT count(*) FROM jobs WHERE user_id = adm) THEN RAISE EXCEPTION 'FALHOU: total do usuário'; END IF;
  IF has_function_privilege('anon', 'public.kpis_admin(text)', 'EXECUTE') THEN RAISE EXCEPTION 'FALHOU: anon executa'; END IF;
  RAISE EXCEPTION 'kpis: OK (rollback)';
END $$;
ROLLBACK;
