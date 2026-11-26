CREATE TABLE public.colorir_pedidos (
 chave uuid PRIMARY KEY, user_id uuid NOT NULL, nome text NOT NULL DEFAULT 'peça',
 fonte text CHECK (fonte IN ('cortesia','creditos','teste')), lote_id uuid REFERENCES public.creditos_lotes(id),
 estado text NOT NULL DEFAULT 'pendente' CHECK (estado IN ('pendente','geral','pronto','rosto','concluido','estornado')),
 ids jsonb, paleta jsonb, slots integer, gasto_usd numeric NOT NULL DEFAULT 0,
 criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.colorir_pedidos TO authenticated;
GRANT ALL ON public.colorir_pedidos TO service_role;
ALTER TABLE public.colorir_pedidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY colorir_read_own ON public.colorir_pedidos FOR SELECT TO authenticated USING (user_id=auth.uid());
CREATE INDEX colorir_user_time ON public.colorir_pedidos(user_id,criado_em);
ALTER TABLE public.creditos_movimentos ADD COLUMN chave_colorir uuid REFERENCES public.colorir_pedidos(chave);
CREATE INDEX movimentos_colorir ON public.creditos_movimentos(chave_colorir);
ALTER TABLE public.ia_chamadas ALTER COLUMN job_id DROP NOT NULL;
ALTER TABLE public.ia_chamadas ADD COLUMN origem text NOT NULL DEFAULT 'analise' CHECK (origem IN ('analise','colorir'));
ALTER TABLE public.ia_chamadas ADD COLUMN chave_colorir uuid REFERENCES public.colorir_pedidos(chave);
CREATE INDEX ia_colorir ON public.ia_chamadas(chave_colorir);
CREATE TABLE public.colorir_ia_bloqueios (user_id uuid PRIMARY KEY, motivo text NOT NULL, criado_em timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.colorir_ia_bloqueios TO service_role;
ALTER TABLE public.colorir_ia_bloqueios ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.consumir_colorir(p_user uuid,p_chave uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; c record; t record; l record; fonte text; cnt integer; hoje timestamptz:=public.inicio_dia_sp(now()); h text; dono uuid; pend uuid;
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
  IF cnt<coalesce(c.por_dia,0) THEN fonte:='cortesia'; END IF;
 END IF;
 IF fonte IS NULL AND public.saldo_creditos(p_user)>=1 THEN fonte:='creditos'; END IF;
 IF fonte IS NULL THEN
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
  fonte:='teste';
 END IF;
 INSERT INTO colorir_pedidos(chave,user_id,fonte) VALUES(p_chave,p_user,fonte);
 IF fonte='creditos' THEN
  SELECT * INTO l FROM creditos_lotes WHERE user_id=p_user AND restante>0 AND (expira_em IS NULL OR expira_em>now()) ORDER BY expira_em ASC NULLS LAST,criado_em,id FOR UPDATE LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'sem_creditos'; END IF;
  UPDATE creditos_lotes SET restante=restante-1 WHERE id=l.id;
  UPDATE colorir_pedidos SET lote_id=l.id WHERE chave=p_chave;
  INSERT INTO creditos_movimentos(user_id,tipo,quantidade,lote_id,chave_colorir,motivo) VALUES(p_user,'reserva',-1,l.id,p_chave,'Colorir pela foto: peça');
 END IF;
 RETURN jsonb_build_object('fonte',fonte,'estado','pendente');
END $$;
REVOKE ALL ON FUNCTION public.consumir_colorir(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consumir_colorir(uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.estornar_colorir(p_chave uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record;
BEGIN
 SELECT * INTO r FROM colorir_pedidos WHERE chave=p_chave;
 IF NOT FOUND THEN RETURN; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('criar_analise:'||r.user_id::text));
 SELECT * INTO r FROM colorir_pedidos WHERE chave=p_chave FOR UPDATE;
 IF r.estado='estornado' THEN RETURN; END IF;
 IF r.fonte='creditos' AND r.lote_id IS NOT NULL THEN
  UPDATE creditos_lotes SET restante=restante+1 WHERE id=r.lote_id;
  INSERT INTO creditos_movimentos(user_id,tipo,quantidade,lote_id,chave_colorir,motivo) VALUES(r.user_id,'estorno',1,r.lote_id,p_chave,'Colorir pela foto: '||r.nome);
 END IF;
 UPDATE colorir_pedidos SET estado='estornado',atualizado_em=now() WHERE chave=p_chave;
END $$;
REVOKE ALL ON FUNCTION public.estornar_colorir(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.estornar_colorir(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.iniciar_colorir_etapa(p_user uuid,p_chave uuid,p_etapa text,p_nome text,p_ids jsonb,p_slots integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('criar_analise:'||p_user::text));
 IF p_etapa NOT IN ('geral','rosto') OR p_slots<1 OR p_slots>16 OR length(p_nome)>200 OR jsonb_typeof(p_ids)<>'array' OR jsonb_array_length(p_ids)>60 THEN RAISE EXCEPTION 'dados_invalidos'; END IF;
 IF p_etapa='geral' THEN PERFORM public.consumir_colorir(p_user,p_chave); END IF;
 SELECT * INTO r FROM colorir_pedidos WHERE chave=p_chave FOR UPDATE;
 IF NOT FOUND OR r.user_id<>p_user THEN RAISE EXCEPTION 'nao_autorizado'; END IF;
 IF (p_etapa='geral' AND r.estado<>'pendente') OR (p_etapa='rosto' AND r.estado<>'pronto') THEN RAISE EXCEPTION 'etapa_ja_usada'; END IF;
 IF p_etapa='rosto' AND (r.ids<>p_ids OR r.slots<>p_slots) THEN RAISE EXCEPTION 'dados_invalidos'; END IF;
 UPDATE colorir_pedidos SET estado=p_etapa,nome=p_nome,ids=p_ids,slots=p_slots,atualizado_em=now() WHERE chave=p_chave;
 UPDATE creditos_movimentos SET motivo='Colorir pela foto: '||p_nome WHERE chave_colorir=p_chave;
 RETURN jsonb_build_object('paleta',r.paleta,'gasto_usd',r.gasto_usd);
END $$;
REVOKE ALL ON FUNCTION public.iniciar_colorir_etapa(uuid,uuid,text,text,jsonb,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.iniciar_colorir_etapa(uuid,uuid,text,text,jsonb,integer) TO service_role;
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
-- Shared daily quota guard: only adds Colorir usage to the existing quota, no other analysis behavior changes.
CREATE OR REPLACE FUNCTION public.colorir_cota_compartilhada() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE extra integer; usado integer; limite integer;
BEGIN
 IF NEW.fonte NOT IN ('teste','cortesia') THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('criar_analise:'||NEW.user_id::text));
 SELECT count(*) INTO extra FROM colorir_pedidos WHERE user_id=NEW.user_id AND fonte=NEW.fonte AND estado<>'estornado' AND criado_em>=public.inicio_dia_sp(now());
 IF extra=0 THEN RETURN NEW; END IF;
 SELECT count(*) INTO usado FROM jobs WHERE user_id=NEW.user_id AND fonte=NEW.fonte AND criado_em>=public.inicio_dia_sp(now()) AND public.job_contou(id,estado);
 IF NEW.fonte='teste' THEN limite:=1; ELSE SELECT por_dia INTO limite FROM cortesias WHERE user_id=NEW.user_id AND ativa AND tipo='uso_diario' AND inicio<=now() AND (fim IS NULL OR fim>=now()) ORDER BY criado_em DESC,id DESC LIMIT 1; END IF;
 IF usado+extra>=coalesce(limite,0) THEN RAISE EXCEPTION 'limite_diario'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.colorir_cota_compartilhada() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER colorir_shared_quota BEFORE INSERT ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.colorir_cota_compartilhada();