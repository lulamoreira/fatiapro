-- admin_resetar_meu_aceite regression test. Verifies:
-- 1. Anonymous/non-admin refusal (42501).
-- 2. Admin own consent reset (NULL).
-- 3. Audit log entry creation.
-- 4. Isolation (other profiles unchanged).
-- 5. Execution grants.
BEGIN;

DO $$
DECLARE
  admin_id uuid := gen_random_uuid();
  user_id uuid := gen_random_uuid();
  ok boolean;
BEGIN
  -- 1. Setup users and state
  INSERT INTO auth.users (id, email) VALUES (admin_id, 'admin@test.com'), (user_id, 'user@test.com');
  -- Profile should exist via trigger; ensure version is set
  UPDATE public.profiles SET termos_versao = '1.0', termos_aceitos_em = now() WHERE id IN (admin_id, user_id);
  INSERT INTO public.app_admins (user_id) VALUES (admin_id);

  -- 2. Test: Anonymous refusal
  PERFORM set_config('request.jwt.claims', NULL, true);
  ok := false;
  BEGIN
    PERFORM admin_resetar_meu_aceite();
  EXCEPTION WHEN others THEN
    IF sqlstate = '42501' THEN ok := true; END IF;
  END;
  IF NOT ok THEN RAISE EXCEPTION 'Anon deveria ser recusado com 42501'; END IF;

  -- 3. Test: Non-admin refusal
  PERFORM set_config('request.jwt.claims', json_build_object('sub', user_id)::text, true);
  ok := false;
  BEGIN
    PERFORM admin_resetar_meu_aceite();
  EXCEPTION WHEN others THEN
    IF sqlstate = '42501' THEN ok := true; END IF;
  END;
  IF NOT ok THEN RAISE EXCEPTION 'Non-admin deveria ser recusado com 42501'; END IF;

  -- 4. Test: Admin own reset and audit
  PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_id)::text, true);
  PERFORM admin_resetar_meu_aceite();

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = admin_id AND (termos_versao IS NOT NULL OR termos_aceitos_em IS NOT NULL)) THEN
    RAISE EXCEPTION 'Aceite do admin deveria ser nulo';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.admin_audit WHERE admin_id = admin_id AND acao = 'resetou_proprio_aceite_termos') THEN
    RAISE EXCEPTION 'Audit log não encontrado';
  END IF;

  -- 5. Test: Isolation
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id AND termos_versao = '1.0') THEN
    RAISE EXCEPTION 'Outro perfil não deveria ser alterado';
  END IF;

  -- 6. Test: Grants
  IF has_function_privilege('anon', 'admin_resetar_meu_aceite()', 'execute') THEN
    RAISE EXCEPTION 'Anon não deveria ter permissão de execução';
  END IF;
  IF NOT has_function_privilege('authenticated', 'admin_resetar_meu_aceite()', 'execute') THEN
    RAISE EXCEPTION 'Authenticated deveria ter permissão de execução';
  END IF;

  RAISE NOTICE 'ADMIN_RESETAR_MEU_ACEITE_OK';
END $$;

ROLLBACK;
