-- Novo roteiro 'producao' (Produção em lote): mesmas regras de cobrança de reduzir_tempo.

-- 1) jobs.roteiro passa a aceitar 'producao'
ALTER TABLE public.jobs DROP CONSTRAINT jobs_roteiro_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_roteiro_check
  CHECK (roteiro IN ('config_geral','reduzir_tempo','checklist','preco','producao'));

-- 2) estimativas_roteiro: aceita 'producao' e ganha a linha copiada de reduzir_tempo
ALTER TABLE public.estimativas_roteiro DROP CONSTRAINT estimativas_roteiro_roteiro_check;
ALTER TABLE public.estimativas_roteiro ADD CONSTRAINT estimativas_roteiro_roteiro_check
  CHECK (roteiro IN ('config_geral','reduzir_tempo','checklist','preco','producao'));
INSERT INTO public.estimativas_roteiro (roteiro, fatiamentos_tipicos, tokens_entrada_tipicos, tokens_saida_tipicos)
SELECT 'producao', fatiamentos_tipicos, tokens_entrada_tipicos, tokens_saida_tipicos
FROM public.estimativas_roteiro WHERE roteiro = 'reduzir_tempo';

-- 3) criar_analise aceita 'producao' (cobrança idêntica a reduzir_tempo: 1 crédito, 2 no Premium)
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
  if p_roteiro not in ('config_geral','reduzir_tempo','checklist','preco','producao') then
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
          coalesce(p_premium, false) and v_motor = 'fatiapro' and p_roteiro in ('reduzir_tempo','config_geral','producao'),
          v_fonte, p_arquivo_path, p_nome_peca, 'na_fila')
  returning id into v_job;
  if v_fonte = 'creditos' then perform public.reservar_credito(p_user, v_job, v_custo); end if;
  return jsonb_build_object('job_id', v_job);
end $$;
GRANT EXECUTE ON FUNCTION public.criar_analise(uuid, uuid, text, text, jsonb, text, boolean, text, text) TO service_role;

-- 4) kpis_admin: por_roteiro ganha a chave 'producao'
CREATE OR REPLACE FUNCTION public.kpis_admin(p_periodo text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ini timestamptz;
  hoje timestamptz := date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo';
  cambio numeric; tx_pix numeric; tx_cartao numeric;
  bruta numeric; taxa numeric; ia_usd numeric;
  r jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Você não tem permissão' USING ERRCODE = '42501'; END IF;
  IF p_periodo NOT IN ('hoje','7d','30d','mes') THEN RAISE EXCEPTION 'Período inválido' USING ERRCODE = '22023'; END IF;
  ini := CASE p_periodo
    WHEN 'hoje' THEN hoje
    WHEN '7d' THEN hoje - interval '6 days'
    WHEN '30d' THEN hoje - interval '29 days'
    ELSE date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo' END;
  SELECT COALESCE(NULLIF((SELECT (valor #>> '{}')::numeric FROM config_app WHERE chave = 'cambio_brl'), 0), 5.5) INTO cambio;
  SELECT COALESCE((SELECT (valor #>> '{}')::numeric FROM config_app WHERE chave = 'taxa_pix_pct'), 1) INTO tx_pix;
  SELECT COALESCE((SELECT (valor #>> '{}')::numeric FROM config_app WHERE chave = 'taxa_cartao_pct'), 5) INTO tx_cartao;
  SELECT COALESCE(SUM(valor_centavos), 0) / 100.0,
         COALESCE(SUM(valor_centavos / 100.0 * (CASE WHEN metodo IN ('pix','bank_transfer') THEN tx_pix ELSE tx_cartao END) / 100), 0)
    INTO bruta, taxa FROM pedidos WHERE status = 'aprovado' AND pago_em >= ini;
  SELECT COALESCE(SUM(custo_usd), 0) INTO ia_usd FROM ia_chamadas WHERE criado_em >= ini;

  SELECT jsonb_build_object(
    'fila_parada', (SELECT count(*) FROM jobs WHERE estado = 'na_fila' AND criado_em < now() - interval '10 minutes'),
    'mp_problemas', (SELECT count(*) FROM mp_eventos WHERE COALESCE(motivo, '') <> 'ok' AND criado_em >= ini),
    'pedidos_pendentes_1h', (SELECT count(*) FROM pedidos WHERE status = 'pendente' AND criado_em < now() - interval '1 hour'),
    'ponte_desatualizada', (SELECT count(*) FROM devices d WHERE NOT d.revogado AND d.versao_ponte IS NOT NULL
        AND public.versao_num(d.versao_ponte) < (SELECT max(public.versao_num(v.versao)) FROM ponte_versoes v WHERE v.publicada AND v.plataforma = d.sistema)),
    'usuarios_total', (SELECT count(*) FROM auth.users),
    'usuarios_novos', (SELECT count(*) FROM auth.users WHERE created_at >= ini),
    'usuarios_ativos', (SELECT count(DISTINCT user_id) FROM jobs WHERE criado_em >= ini),
    'em_teste', (SELECT count(*) FROM testes_gratis WHERE inicio <= now() AND fim > now()),
    'pagantes', (SELECT count(DISTINCT user_id) FROM pedidos WHERE status = 'aprovado'),
    'bloqueados', (SELECT count(*) FROM auth.users WHERE banned_until > now()),
    'computadores_conectados', (SELECT count(*) FROM devices WHERE NOT revogado AND ultimo_contato > now() - interval '60 seconds'),
    'computadores_total', (SELECT count(*) FROM devices WHERE NOT revogado),
    'sem_computador', (SELECT count(*) FROM auth.users u WHERE NOT EXISTS (SELECT 1 FROM devices d WHERE d.user_id = u.id AND NOT d.revogado)),
    'analises', (SELECT count(*) FROM jobs WHERE criado_em >= ini),
    'concluidas', (SELECT count(*) FROM jobs WHERE criado_em >= ini AND estado = 'concluido'),
    'erros', (SELECT count(*) FROM jobs WHERE criado_em >= ini AND estado = 'erro'),
    'por_roteiro', (SELECT jsonb_build_object(
        'config_geral', count(*) FILTER (WHERE roteiro = 'config_geral'),
        'reduzir_tempo', count(*) FILTER (WHERE roteiro = 'reduzir_tempo'),
        'checklist', count(*) FILTER (WHERE roteiro = 'checklist'),
        'preco', count(*) FILTER (WHERE roteiro = 'preco'),
        'producao', count(*) FILTER (WHERE roteiro = 'producao')) FROM jobs WHERE criado_em >= ini),
    'receita_bruta', bruta,
    'receita_liquida', bruta - taxa,
    'pedidos_aprovados', (SELECT count(*) FROM pedidos WHERE status = 'aprovado' AND pago_em >= ini),
    'custo_ia_usd', ia_usd,
    'margem_brl', bruta - taxa - ia_usd * cambio,
    'creditos_vendidos', (SELECT COALESCE(SUM(creditos), 0) FROM pedidos WHERE status = 'aprovado' AND pago_em >= ini),
    'creditos_consumidos', (SELECT 0 - COALESCE(SUM(quantidade), 0) FROM creditos_movimentos WHERE tipo IN ('reserva','estorno') AND criado_em >= ini),
    'creditos_circulacao', (SELECT COALESCE(SUM(restante), 0) FROM creditos_lotes WHERE restante > 0 AND (expira_em IS NULL OR expira_em > now())),
    'creditos_vencendo_30d', (SELECT COALESCE(SUM(restante), 0) FROM creditos_lotes WHERE restante > 0 AND expira_em > now() AND expira_em <= now() + interval '30 days'),
    'cupons_resgatados', (SELECT count(*) FROM cupom_usos WHERE criado_em >= ini),
    'feedback_total', (SELECT count(*) FROM feedback_respostas WHERE criado_em >= ini),
    'feedback_sentido', (SELECT count(*) FROM feedback_respostas WHERE criado_em >= ini AND fez_sentido = 'sim'),
    'feedback_imprimiu', (SELECT count(*) FROM feedback_respostas WHERE criado_em >= ini AND imprimiu IN ('sim_boa','sim_problema')),
    'feedback_boa', (SELECT count(*) FROM feedback_respostas WHERE criado_em >= ini AND imprimiu = 'sim_boa'),
    'orcamentos', (SELECT count(*) FROM orcamentos WHERE criado_em >= ini),
    'orcamentos_aprovados', (SELECT count(*) FROM orcamentos WHERE criado_em >= ini AND status = 'aprovado'),
    'orcamentos_decididos', (SELECT count(*) FROM orcamentos WHERE criado_em >= ini AND status IN ('aprovado','recusado'))
  ) INTO r;
  RETURN r;
END $$;
GRANT EXECUTE ON FUNCTION public.kpis_admin(text) TO authenticated;