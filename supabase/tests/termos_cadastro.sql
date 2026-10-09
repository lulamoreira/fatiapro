-- Exercise the real signup trigger; synthetic users and profiles are rolled back.
BEGIN;
DO $$
DECLARE
  usuario uuid;
  versao text;
  perfil public.profiles%ROWTYPE;
BEGIN
  FOREACH versao IN ARRAY ARRAY['1.0', '0.9', NULL, '1.0-extra']::text[] LOOP
    usuario := gen_random_uuid();
    INSERT INTO auth.users (id, email, raw_user_meta_data)
    VALUES (usuario, 'termos-teste-' || usuario || '@example.invalid',
            jsonb_build_object('termos_versao', versao));
    SELECT * INTO STRICT perfil FROM public.profiles WHERE id = usuario;
    IF versao = '1.0' THEN
      IF perfil.termos_versao IS DISTINCT FROM '1.0' THEN
        RAISE EXCEPTION 'FALHA: cadastro com 1.0 deve registrar a versão';
      END IF;
      IF perfil.termos_aceitos_em IS DISTINCT FROM now() THEN
        RAISE EXCEPTION 'FALHA: cadastro com 1.0 deve usar a data do servidor';
      END IF;
    ELSE
      IF perfil.termos_versao IS NOT NULL THEN
        RAISE EXCEPTION 'FALHA: versão diferente de 1.0 deve ficar null';
      END IF;
      IF perfil.termos_aceitos_em IS NOT NULL THEN
        RAISE EXCEPTION 'FALHA: sem versão válida a data deve ficar null';
      END IF;
    END IF;
  END LOOP;
  RAISE NOTICE 'TERMOS_CADASTRO_OK';
END $$;
ROLLBACK;