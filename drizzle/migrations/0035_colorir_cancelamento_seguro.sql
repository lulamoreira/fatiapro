CREATE OR REPLACE FUNCTION public.cancelar_colorir(p_user uuid,p_chave uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('criar_analise:'||p_user::text));
 SELECT * INTO r FROM colorir_pedidos WHERE chave=p_chave FOR UPDATE;
 IF NOT FOUND THEN INSERT INTO colorir_pedidos(chave,user_id,estado) VALUES(p_chave,p_user,'estornado'); RETURN true; END IF;
 IF r.user_id<>p_user THEN RAISE EXCEPTION 'nao_autorizado'; END IF;
 IF r.estado IN ('pendente','geral') THEN PERFORM public.estornar_colorir(p_chave); RETURN true; END IF;
 RETURN r.estado='estornado';
END $$;
REVOKE ALL ON FUNCTION public.cancelar_colorir(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_colorir(uuid,uuid) TO service_role;
DELETE FROM public.colorir_ia_bloqueios WHERE motivo='acesso_negado';