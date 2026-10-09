-- Real RPC authorization, own-row isolation and audit; all test data rolls back.
BEGIN;
DO $$
DECLARE
  administrador uuid := gen_random_uuid();
  comum uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
    (administrador, 'admin-termos-' || administrador || '@example.invalid', '{"termos_versao":"1.0"}'),
    (comum, 'comum-termos-' || comum || '@example.invalid', '{"termos_versao":"1.0"}');
  INSERT INTO public.app_admins (user_id) VALUES (administrador);

  PERFORM set_config('request.jwt.claim.sub', '', true);
  BEGIN
    PERFORM public.admin_resetar_meu_aceite();
    RAISE EXCEPTION 'FALHA: sem identidade deve ser recusado';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  PERFORM set_config('request.jwt.claim.sub', comum::text, true);
  BEGIN
    PERFORM public.admin_resetar_meu_aceite();
    RAISE EXCEPTION 'FALHA: conta comum deve ser recusada';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  IF EXISTS (SELECT 1 FROM public.admin_audit WHERE admin_id = comum) THEN
    RAISE EXCEPTION 'FALHA: tentativa recusada não deve registrar sucesso';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', administrador::text, true);
  PERFORM public.admin_resetar_meu_aceite();
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = administrador AND termos_versao IS NULL AND termos_aceitos_em IS NULL) THEN
    RAISE EXCEPTION 'FALHA: limpar apenas o aceite do admin';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = comum AND termos_versao = '1.0' AND termos_aceitos_em = now()) THEN
    RAISE EXCEPTION 'FALHA: aceite de outra conta foi alterado';
  END IF;
  IF (SELECT count(*) FROM public.admin_audit WHERE admin_id = administrador AND alvo_user_id = administrador AND acao = 'resetou_proprio_aceite_termos') <> 1 THEN
    RAISE EXCEPTION 'FALHA: auditoria deve registrar admin como autor e alvo';
  END IF;
  IF has_function_privilege('anon', 'public.admin_resetar_meu_aceite()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHA: anon não pode executar';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.admin_resetar_meu_aceite()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHA: authenticated precisa executar';
  END IF;
END $$;
ROLLBACK;