-- jobs
ALTER TABLE public.jobs ADD COLUMN premium boolean NOT NULL DEFAULT false;
ALTER TABLE public.jobs ADD COLUMN fonte text CHECK (fonte IS NULL OR fonte IN ('creditos','teste','cortesia','gratis','admin'));
ALTER TABLE public.jobs ADD COLUMN creditos_reservados integer NOT NULL DEFAULT 0 CHECK (creditos_reservados >= 0);
ALTER TABLE public.jobs DROP CONSTRAINT jobs_motor_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_motor_check CHECK (motor IN ('fatiapro','api','assinatura'));
DROP POLICY IF EXISTS jobs_insert_own ON public.jobs;
REVOKE INSERT ON public.jobs FROM authenticated, anon;
CREATE INDEX IF NOT EXISTS jobs_user_criado_idx ON public.jobs (user_id, criado_em DESC);

-- devices
ALTER TABLE public.devices ADD COLUMN maquina_hash text CHECK (maquina_hash IS NULL OR maquina_hash ~ '^[0-9a-f]{64}$');

-- creditos_lotes
CREATE TABLE public.creditos_lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  origem text NOT NULL CHECK (origem IN ('teste','cortesia','compra','assinatura','cupom','ajuste')),
  quantidade integer NOT NULL CHECK (quantidade > 0),
  restante integer NOT NULL CHECK (restante >= 0),
  expira_em timestamptz,
  referencia text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX creditos_lotes_user_idx ON public.creditos_lotes (user_id, expira_em);
GRANT SELECT ON public.creditos_lotes TO authenticated;
GRANT ALL ON public.creditos_lotes TO service_role;
ALTER TABLE public.creditos_lotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY creditos_lotes_select_own ON public.creditos_lotes FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- creditos_movimentos
CREATE TABLE public.creditos_movimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('entrada','reserva','estorno','vencimento','ajuste')),
  quantidade integer NOT NULL,
  lote_id uuid REFERENCES public.creditos_lotes(id) ON DELETE SET NULL,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  motivo text,
  admin_id uuid,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX creditos_mov_user_idx ON public.creditos_movimentos (user_id, criado_em DESC);
CREATE INDEX creditos_mov_job_idx ON public.creditos_movimentos (job_id);
GRANT SELECT ON public.creditos_movimentos TO authenticated;
GRANT ALL ON public.creditos_movimentos TO service_role;
ALTER TABLE public.creditos_movimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY creditos_mov_select_own ON public.creditos_movimentos FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- testes_gratis
CREATE TABLE public.testes_gratis (
  user_id uuid PRIMARY KEY,
  inicio timestamptz NOT NULL DEFAULT now(),
  fim timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  maquina_hash text
);
GRANT SELECT ON public.testes_gratis TO authenticated;
GRANT ALL ON public.testes_gratis TO service_role;
ALTER TABLE public.testes_gratis ENABLE ROW LEVEL SECURITY;
CREATE POLICY testes_gratis_select_own ON public.testes_gratis FOR SELECT TO authenticated USING (auth.uid() = user_id);
INSERT INTO public.testes_gratis (user_id, inicio, fim)
SELECT u.id, u.created_at, u.created_at + interval '14 days' FROM auth.users u
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.criar_teste_gratis()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  insert into public.testes_gratis (user_id, inicio, fim) values (new.id, now(), now() + interval '14 days')
  on conflict (user_id) do nothing;
  return new;
end $$;
REVOKE EXECUTE ON FUNCTION public.criar_teste_gratis() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER profiles_criar_teste_gratis AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.criar_teste_gratis();

-- maquinas_teste
CREATE TABLE public.maquinas_teste (
  maquina_hash text PRIMARY KEY,
  user_id uuid NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.maquinas_teste TO service_role;
ALTER TABLE public.maquinas_teste ENABLE ROW LEVEL SECURITY;

-- cortesias
CREATE TABLE public.cortesias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('creditos','uso_diario')),
  por_dia integer CHECK (por_dia IS NULL OR por_dia > 0),
  premium boolean NOT NULL DEFAULT false,
  inicio timestamptz NOT NULL DEFAULT now(),
  fim timestamptz,
  motivo text,
  admin_id uuid,
  ativa boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cortesias_user_idx ON public.cortesias (user_id);
GRANT SELECT ON public.cortesias TO authenticated;
GRANT ALL ON public.cortesias TO service_role;
ALTER TABLE public.cortesias ENABLE ROW LEVEL SECURITY;
CREATE POLICY cortesias_select_own ON public.cortesias FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- feedback_respostas
CREATE TABLE public.feedback_respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  job_id uuid NOT NULL UNIQUE REFERENCES public.jobs(id) ON DELETE CASCADE,
  fez_sentido text NOT NULL CHECK (fez_sentido IN ('sim','em_parte','nao')),
  imprimiu text NOT NULL CHECK (imprimiu IN ('sim_boa','sim_problema','ainda_nao','nao_vou')),
  problemas text[] NOT NULL DEFAULT '{}' CHECK (problemas <@ ARRAY['descolou','suporte','acabamento','fraca','outro']::text[]),
  tempo_poupado text CHECK (tempo_poupado IS NULL OR tempo_poupado IN ('nada','ate_15','15_60','mais_60')),
  comentario text CHECK (comentario IS NULL OR char_length(comentario) <= 500),
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.feedback_respostas TO authenticated;
GRANT ALL ON public.feedback_respostas TO service_role;
ALTER TABLE public.feedback_respostas ENABLE ROW LEVEL SECURITY;
CREATE POLICY feedback_select_own ON public.feedback_respostas FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY feedback_insert_own ON public.feedback_respostas FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.jobs j WHERE j.id = feedback_respostas.job_id AND j.user_id = auth.uid()
      AND j.estado = 'concluido' AND j.roteiro IN ('reduzir_tempo','config_geral')));

-- ia_chamadas
CREATE TABLE public.ia_chamadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  modelo text NOT NULL,
  entrada integer NOT NULL DEFAULT 0,
  saida integer NOT NULL DEFAULT 0,
  cache_leitura integer NOT NULL DEFAULT 0,
  cache_escrita integer NOT NULL DEFAULT 0,
  custo_usd numeric NOT NULL DEFAULT 0,
  duracao_ms integer NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ia_chamadas_job_idx ON public.ia_chamadas (job_id);
GRANT ALL ON public.ia_chamadas TO service_role;
ALTER TABLE public.ia_chamadas ENABLE ROW LEVEL SECURITY;

-- config_app
CREATE TABLE public.config_app (chave text PRIMARY KEY, valor jsonb NOT NULL);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.config_app TO authenticated;
GRANT ALL ON public.config_app TO service_role;
ALTER TABLE public.config_app ENABLE ROW LEVEL SECURITY;
CREATE POLICY config_app_admin_all ON public.config_app FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
INSERT INTO public.config_app (chave, valor) VALUES
  ('alerta_gasto_usd_dia', '5'), ('limite_diario_gratis', '20'), ('uso_justo_por_dia', '10'),
  ('cambio_brl', '5.5'), ('custo_teto_job_usd', '0.5')
ON CONFLICT (chave) DO NOTHING;

-- ===== Funções de crédito =====
CREATE OR REPLACE FUNCTION public.inicio_dia_sp(p timestamptz DEFAULT now())
RETURNS timestamptz LANGUAGE sql STABLE SET search_path = public AS $$
  select (date_trunc('day', p at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo'
$$;

CREATE OR REPLACE FUNCTION public.saldo_creditos(p_user uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select coalesce(sum(restante), 0)::int from public.creditos_lotes
   where user_id = p_user and restante > 0 and (expira_em is null or expira_em > now())
$$;

CREATE OR REPLACE FUNCTION public.vencer_lotes(p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare r record;
begin
  for r in select id, restante from public.creditos_lotes
            where user_id = p_user and restante > 0 and expira_em is not null and expira_em <= now()
            for update loop
    insert into public.creditos_movimentos (user_id, tipo, quantidade, lote_id, motivo)
    values (p_user, 'vencimento', -r.restante, r.id, 'lote vencido');
    update public.creditos_lotes set restante = 0 where id = r.id;
  end loop;
end $$;

CREATE OR REPLACE FUNCTION public.reservar_credito(p_user uuid, p_job uuid, p_qtd integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare r record; falta int := p_qtd; usa int; total int;
begin
  if p_qtd <= 0 then raise exception 'quantidade_invalida'; end if;
  select coalesce(sum(restante),0) into total from (
    select restante from public.creditos_lotes
     where user_id = p_user and restante > 0 and (expira_em is null or expira_em > now())
     for update) s;
  if total < p_qtd then raise exception 'sem_creditos'; end if;
  for r in select id, restante from public.creditos_lotes
            where user_id = p_user and restante > 0 and (expira_em is null or expira_em > now())
            order by expira_em asc nulls last, criado_em asc, id asc for update loop
    exit when falta = 0;
    usa := least(falta, r.restante);
    update public.creditos_lotes set restante = restante - usa where id = r.id;
    insert into public.creditos_movimentos (user_id, tipo, quantidade, lote_id, job_id, motivo)
    values (p_user, 'reserva', -usa, r.id, p_job, 'reserva da análise');
    falta := falta - usa;
  end loop;
  update public.jobs set creditos_reservados = p_qtd where id = p_job;
end $$;

CREATE OR REPLACE FUNCTION public.estornar_credito(p_job uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare j record; r record;
begin
  select id, user_id, creditos_reservados into j from public.jobs where id = p_job for update;
  if j.id is null or j.creditos_reservados = 0 then return; end if;
  for r in select lote_id, sum(quantidade) as q from public.creditos_movimentos
            where job_id = p_job and tipo in ('reserva','estorno') and lote_id is not null
            group by lote_id having sum(quantidade) < 0 loop
    update public.creditos_lotes set restante = restante + (-r.q) where id = r.lote_id;
    insert into public.creditos_movimentos (user_id, tipo, quantidade, lote_id, job_id, motivo)
    values (j.user_id, 'estorno', -r.q, r.lote_id, p_job, 'estorno da análise');
  end loop;
  update public.jobs set creditos_reservados = 0 where id = p_job;
end $$;

CREATE OR REPLACE FUNCTION public.jobs_estorno_auto()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if new.estado is distinct from old.estado and new.estado in ('erro','cancelado','limite_de_gasto')
     and not exists (select 1 from public.job_events e where e.job_id = new.id and e.tipo = 'proposta') then
    perform public.estornar_credito(new.id);
  end if;
  return null;
end $$;
CREATE TRIGGER jobs_estorno_auto AFTER UPDATE OF estado ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.jobs_estorno_auto();

-- Job that counts as "used" (not refunded-before-proposal)
CREATE OR REPLACE FUNCTION public.job_contou(p_job uuid, p_estado text)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  select not (p_estado in ('erro','cancelado','limite_de_gasto')
              and not exists (select 1 from public.job_events e where e.job_id = p_job and e.tipo = 'proposta'))
$$;

CREATE OR REPLACE FUNCTION public.criar_analise(
  p_user uuid, p_device uuid, p_roteiro text, p_fatiador text, p_opcoes jsonb,
  p_motor text, p_premium boolean, p_arquivo_path text, p_nome_peca text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  v_admin boolean; v_motor text := p_motor; v_hash text; v_fonte text; v_custo int;
  v_hoje timestamptz := public.inicio_dia_sp(now()); v_cnt int; v_lim int;
  c record; t record; v_dono uuid; v_pend uuid; v_job uuid;
begin
  perform pg_advisory_xact_lock(hashtext('criar_analise:' || p_user::text));
  -- a) device + file path
  select maquina_hash into v_hash from public.devices where id = p_device and user_id = p_user and not revogado;
  if not found then return jsonb_build_object('erro', true, 'codigo', 'computador_invalido', 'detalhe', 'Computador não encontrado ou desconectado.'); end if;
  if p_arquivo_path is not null and not starts_with(p_arquivo_path, p_user::text || '/') then
    return jsonb_build_object('erro', true, 'codigo', 'arquivo_invalido', 'detalhe', 'Arquivo inválido.'); end if;
  if p_roteiro not in ('config_geral','reduzir_tempo','checklist','preco') then
    return jsonb_build_object('erro', true, 'codigo', 'roteiro_invalido', 'detalhe', 'Roteiro inválido.'); end if;
  -- b) motor
  v_admin := exists (select 1 from public.app_admins where user_id = p_user);
  if not v_admin or v_motor not in ('api','assinatura') then v_motor := 'fatiapro'; end if;

  if v_motor in ('api','assinatura') then
    v_fonte := 'admin'; -- e)
  elsif p_roteiro in ('checklist','preco') then
    -- c)
    select coalesce((valor #>> '{}')::int, 20) into v_lim from public.config_app where chave = 'limite_diario_gratis';
    v_lim := coalesce(v_lim, 20);
    select count(*) into v_cnt from public.jobs where user_id = p_user and fonte = 'gratis' and criado_em >= v_hoje;
    if v_cnt >= v_lim then return jsonb_build_object('erro', true, 'codigo', 'limite_diario', 'detalhe', 'Você chegou ao limite diário de análises grátis.'); end if;
    v_fonte := 'gratis';
  else
    -- d)
    v_custo := case when p_premium then 2 else 1 end;
    perform public.vencer_lotes(p_user);
    select * into c from public.cortesias
     where user_id = p_user and ativa and tipo = 'uso_diario' and inicio <= now() and (fim is null or now() <= fim)
     order by criado_em desc, id desc limit 1;
    if found then
      select count(*) into v_cnt from public.jobs where user_id = p_user and fonte = 'cortesia' and criado_em >= v_hoje and public.job_contou(id, estado);
      if v_cnt < coalesce(c.por_dia, 0) and (not p_premium or c.premium) then v_fonte := 'cortesia'; end if;
    end if;
    if v_fonte is null and public.saldo_creditos(p_user) >= v_custo then v_fonte := 'creditos'; end if;
    if v_fonte is null then
      select * into t from public.testes_gratis where user_id = p_user;
      if found and now() < t.fim then
        if p_premium then return jsonb_build_object('erro', true, 'codigo', 'premium_no_teste', 'detalhe', 'A análise Premium não faz parte do teste grátis.'); end if;
        if v_hash is null then return jsonb_build_object('erro', true, 'codigo', 'maquina_sem_identificacao', 'detalhe', 'Atualize a ponte para usar o teste grátis.'); end if;
        select user_id into v_dono from public.maquinas_teste where maquina_hash = v_hash;
        if v_dono is not null and v_dono <> p_user then
          return jsonb_build_object('erro', true, 'codigo', 'teste_ja_usado_nesta_maquina', 'detalhe', 'O teste grátis já foi usado neste computador por outra conta.'); end if;
        select count(*) into v_cnt from public.jobs where user_id = p_user and fonte = 'teste' and criado_em >= v_hoje and public.job_contou(id, estado);
        if v_cnt >= 1 then return jsonb_build_object('erro', true, 'codigo', 'teste_hoje_usado', 'detalhe', 'Você já usou a otimização grátis de hoje.'); end if;
        select j.id into v_pend from public.jobs j where j.user_id = p_user and j.fonte = 'teste' and j.estado = 'concluido'
          order by j.criado_em desc, j.id desc limit 1;
        if v_pend is not null and not exists (select 1 from public.feedback_respostas f where f.job_id = v_pend) then
          return jsonb_build_object('erro', true, 'codigo', 'questionario_pendente', 'detalhe', 'Responda o questionário da última análise para continuar.', 'job_pendente', v_pend); end if;
        if v_dono is null then insert into public.maquinas_teste (maquina_hash, user_id) values (v_hash, p_user); end if;
        update public.testes_gratis set maquina_hash = coalesce(maquina_hash, v_hash) where user_id = p_user;
        v_fonte := 'teste';
      else
        return jsonb_build_object('erro', true, 'codigo', 'sem_creditos', 'detalhe', 'Você não tem créditos para esta análise.');
      end if;
    end if;
  end if;

  insert into public.jobs (user_id, device_id, roteiro, fatiador, opcoes, motor, premium, fonte, arquivo_path, nome_peca, estado)
  values (p_user, p_device, p_roteiro, p_fatiador, coalesce(p_opcoes, '{}'::jsonb), v_motor,
          coalesce(p_premium, false) and v_motor = 'fatiapro' and p_roteiro in ('reduzir_tempo','config_geral'),
          v_fonte, p_arquivo_path, p_nome_peca, 'na_fila')
  returning id into v_job;
  if v_fonte = 'creditos' then perform public.reservar_credito(p_user, v_job, v_custo); end if;
  return jsonb_build_object('job_id', v_job);
end $$;

REVOKE EXECUTE ON FUNCTION public.saldo_creditos(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.vencer_lotes(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reservar_credito(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.estornar_credito(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.jobs_estorno_auto() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.criar_analise(uuid, uuid, text, text, jsonb, text, boolean, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.saldo_creditos(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.vencer_lotes(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reservar_credito(uuid, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.estornar_credito(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.criar_analise(uuid, uuid, text, text, jsonb, text, boolean, text, text) TO service_role;