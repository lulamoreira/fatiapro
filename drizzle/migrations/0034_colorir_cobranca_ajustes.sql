CREATE OR REPLACE FUNCTION public.consumir_colorir(p_user uuid,p_chave uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; c record; t record; l record; v_fonte text; cnt integer; hoje timestamptz:=public.inicio_dia_sp(now()); h text; dono uuid; pend uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('criar_analise:'||p_user::text));
 SELECT * INTO r FROM colorir_pedidos WHERE chave=p_chave FOR UPDATE;
 IF FOUND THEN IF r.user_id<>p_user THEN RAISE EXCEPTION 'nao_autorizado'; END IF; RETURN jsonb_build_object('fonte',r.fonte,'estado',r.estado); END IF;
 SELECT count(*) INTO cnt FROM colorir_pedidos WHERE user_id=p_user AND criado_em>now()-interval '1 hour' AND fonte IS NOT NULL;
 IF cnt>=10 THEN RAISE EXCEPTION 'limite_hora'; END IF;
 PERFORM public.vencer_lotes(p_user);
 SELECT * INTO c FROM cortesias WHERE user_id=p_user AND ativa AND tipo='uso_diario' AND inicio<=now() AND (fim IS NULL OR fim>=now()) ORDER BY criado_em DESC,id DESC LIMIT 1;
 IF FOUND THEN
  SELECT (SELECT count(*) FROM jobs WHERE user_id=p_user AND fonte='cortesia' AND criado_em>=hoje AND public.job_contou(id,estado))+(SELECT count(*) FROM colorir_pedidos WHERE user_id=p_user AND fonte='cortesia' AND criado_em>=hoje AND estado<>'estornado') INTO cnt;
  IF cnt<coalesce(c.por_dia,0) THEN v_fonte:='cortesia'; END IF;
 END IF;
 IF v_fonte IS NULL AND public.saldo_creditos(p_user)>=1 THEN v_fonte:='creditos'; END IF;
 IF v_fonte IS NULL THEN
  SELECT * INTO t FROM testes_gratis WHERE user_id=p_user AND fim>now();
  IF NOT FOUND THEN RAISE EXCEPTION 'sem_creditos'; END IF;
  SELECT maquina_hash INTO h FROM devices WHERE user_id=p_user AND NOT revogado AND maquina_hash IS NOT NULL ORDER BY criado_em DESC,id DESC LIMIT 1;
  IF h IS NULL THEN RAISE EXCEPTION 'maquina_sem_identificacao'; END IF;
  SELECT user_id INTO dono FROM maquinas_teste WHERE maquina_hash=h;
  IF dono IS NOT NULL AND dono<>p_user THEN RAISE EXCEPTION 'teste_ja_usado_nesta_maquina'; END IF;
  SELECT (SELECT count(*) FROM jobs WHERE user_id=p_user AND fonte='teste' AND criado_em>=hoje AND public.job_contou(id,estado))+(SELECT count(*) FROM colorir_pedidos WHERE user_id=p_user AND fonte='teste' AND criado_em>=hoje AND estado<>'estornado') INTO cnt;
  IF cnt>=1 THEN RAISE EXCEPTION 'teste_hoje_usado'; END IF;
  SELECT id INTO pend FROM jobs WHERE user_id=p_user AND fonte='teste' AND estado='concluido' ORDER BY criado_em DESC,id DESC LIMIT 1;
  IF pend IS NOT NULL AND NOT EXISTS(SELECT 1 FROM feedback_respostas WHERE job_id=pend) THEN RAISE EXCEPTION 'questionario_pendente'; END IF;
  IF dono IS NULL THEN INSERT INTO maquinas_teste(maquina_hash,user_id) VALUES(h,p_user); END IF;
  UPDATE testes_gratis SET maquina_hash=coalesce(maquina_hash,h) WHERE user_id=p_user;
  v_fonte:='teste';
 END IF;
 INSERT INTO colorir_pedidos(chave,user_id,fonte) VALUES(p_chave,p_user,v_fonte);
 IF v_fonte='creditos' THEN
  SELECT * INTO l FROM creditos_lotes WHERE user_id=p_user AND restante>0 AND (expira_em IS NULL OR expira_em>now()) ORDER BY expira_em ASC NULLS LAST,criado_em,id FOR UPDATE LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'sem_creditos'; END IF;
  UPDATE creditos_lotes SET restante=restante-1 WHERE id=l.id;
  UPDATE colorir_pedidos SET lote_id=l.id WHERE chave=p_chave;
  INSERT INTO creditos_movimentos(user_id,tipo,quantidade,lote_id,chave_colorir,motivo) VALUES(p_user,'reserva',-1,l.id,p_chave,'Colorir pela foto: peça');
 END IF;
 RETURN jsonb_build_object('fonte',v_fonte,'estado','pendente');
END $$;
REVOKE ALL ON FUNCTION public.consumir_colorir(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consumir_colorir(uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.cancelar_colorir(p_user uuid,p_chave uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('criar_analise:'||p_user::text));
 SELECT * INTO r FROM colorir_pedidos WHERE chave=p_chave FOR UPDATE;
 IF NOT FOUND THEN INSERT INTO colorir_pedidos(chave,user_id,estado) VALUES(p_chave,p_user,'estornado'); RETURN true; END IF;
 IF r.user_id<>p_user THEN RAISE EXCEPTION 'nao_autorizado'; END IF;
 IF r.estado IN ('pendente','geral','pronto') THEN PERFORM public.estornar_colorir(p_chave); RETURN true; END IF;
 RETURN r.estado='estornado';
END $$;
REVOKE ALL ON FUNCTION public.cancelar_colorir(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_colorir(uuid,uuid) TO service_role;
DROP TRIGGER colorir_shared_quota ON public.jobs;
DROP FUNCTION public.colorir_cota_compartilhada();
DO $$
DECLARE definition text; old_c text:='select count(*) into v_cnt from public.jobs where user_id = p_user and fonte = ''cortesia'' and criado_em >= v_hoje and public.job_contou(id, estado);'; old_t text:='select count(*) into v_cnt from public.jobs where user_id = p_user and fonte = ''teste'' and criado_em >= v_hoje and public.job_contou(id, estado);';
BEGIN
 SELECT pg_get_functiondef('public.criar_analise(uuid,uuid,text,text,jsonb,text,boolean,text,text)'::regprocedure) INTO definition;
 IF position(old_c in definition)=0 OR position(old_t in definition)=0 THEN RAISE EXCEPTION 'quota source changed'; END IF;
 definition:=replace(definition,old_c,'select (select count(*) from public.jobs where user_id=p_user and fonte=''cortesia'' and criado_em>=v_hoje and public.job_contou(id,estado)) + (select count(*) from public.colorir_pedidos where user_id=p_user and fonte=''cortesia'' and criado_em>=v_hoje and estado<>''estornado'') into v_cnt;');
 definition:=replace(definition,old_t,'select (select count(*) from public.jobs where user_id=p_user and fonte=''teste'' and criado_em>=v_hoje and public.job_contou(id,estado)) + (select count(*) from public.colorir_pedidos where user_id=p_user and fonte=''teste'' and criado_em>=v_hoje and estado<>''estornado'') into v_cnt;');
 EXECUTE definition;
END $$;