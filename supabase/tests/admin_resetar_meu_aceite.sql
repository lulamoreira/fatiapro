-- admin_resetar_meu_aceite regression test.
-- Verifies: auth refusal, own reset, audit logging, isolation, and grants.
BEGIN;

DO $$
DECLARE
  admin_id uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  ok boolean;
BEGIN
  -- 1. Setup (Requires bypass of FK if auth.users is restricted, or run as superuser)
  -- Note: In some environments, we might need to mock auth.users if not permitted.
  -- Here we follow the project's style which assumes these tables are available.
  
  INSERT INTO auth.users (id, email) VALUES (admin_id, 'admin@test.com'), (other_id, 'other@test.com');
  INSERT INTO public.profiles (id, termos_versao, termos_aceitos_em) 
  VALUES (admin_id, '1.0', now()), (other_id, '1.0', now());
  INSERT INTO public.app_admins (user_id) VALUES (admin_id);

  -- 2. Test: Anonymous refusal (no JWT)
  PERFORM set_config('request.jwt.claims', NULL, true);
  ok := false;
  BEGIN
    PERFORM admin_resetar_meu_aceite();
  EXCEPTION WHEN others THEN
    IF sqlstate = '42501' THEN ok := true; END IF;
  END;
  IF NOT ok THEN RAISE EXCEPTION 'Anon deveria ser recusado com 42501'; END IF;

  -- 3. Test: Non-admin refusal
  PERFORM set_config('request.jwt.claims', json_build_object('sub', other_id)::text, true);
  ok := false;
  BEGIN
    PERFORM admin_resetar_meu_aceite();
  EXCEPTION WHEN others THEN
    IF sqlstate = '42501' THEN ok := true; END IF;
  END;
  IF NOT ok THEN RAISE EXCEPTION 'Non-admin deveria ser recusado com 42501'; END IF;

  -- 4. Test: Admin own reset, audit, and isolation
  PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_id)::text, true);
  PERFORM admin_resetar_meu_aceite();

  -- Verify admin profile reset
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = admin_id AND (termos_versao IS NOT NULL OR termos_aceitos_em IS NOT NULL)) THEN
    RAISE EXCEPTION 'Aceite do admin deveria ser nulo';
  END IF;

  -- Verify audit log
  IF NOT EXISTS (SELECT 1 FROM public.admin_audit WHERE admin_id = admin_id AND acao = 'resetou_proprio_aceite_termos') THEN
    RAISE EXCEPTION 'Audit log não encontrado';
  END IF;

  -- Verify isolation (other user untouched)
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = other_id AND termos_versao = '1.0') THEN
    RAISE EXCEPTION 'Outro perfil não deveria ser alterado';
  END IF;

  -- 5. Test: Execution grants
  IF has_function_privilege('anon', 'admin_resetar_meu_aceite()', 'execute') THEN
    RAISE EXCEPTION 'Anon não deveria ter permissão de execução';
  END IF;
  IF NOT has_function_privilege('authenticated', 'admin_resetar_meu_aceite()', 'execute') THEN
    RAISE EXCEPTION 'Authenticated deveria ter permissão de execução';
  END IF;

  RAISE NOTICE 'ADMIN_RESETAR_MEU_ACEITE_OK';
END $$;

ROLLBACK;
