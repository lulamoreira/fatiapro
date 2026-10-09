CREATE OR REPLACE FUNCTION public.kpis_usuario()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH u AS (SELECT auth.uid() AS id),
  mes AS (SELECT date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo' AS ini),
  j AS (SELECT * FROM jobs WHERE user_id = (SELECT id FROM u)),
  eco AS (
    SELECT
      COALESCE(SUM(GREATEST(0, (resultado->'partida'->>'segundos')::numeric - (resultado->'final'->>'segundos')::numeric)), 0) AS seg,
      COALESCE(SUM(GREATEST(0, (resultado->'partida'->>'gramas')::numeric - (resultado->'final'->>'gramas')::numeric)), 0) AS g
    FROM j WHERE estado = 'concluido' AND roteiro = 'reduzir_tempo'
      AND jsonb_typeof(resultado->'partida'->'segundos') = 'number' AND jsonb_typeof(resultado->'final'->'segundos') = 'number'
  ),
  eco_g AS (
    SELECT COALESCE(SUM(GREATEST(0, (resultado->'partida'->>'gramas')::numeric - (resultado->'final'->>'gramas')::numeric)), 0) AS g
    FROM j WHERE estado = 'concluido' AND roteiro = 'reduzir_tempo'
      AND jsonb_typeof(resultado->'partida'->'gramas') = 'number' AND jsonb_typeof(resultado->'final'->'gramas') = 'number'
  ),
  o AS (SELECT * FROM orcamentos WHERE user_id = (SELECT id FROM u)),
  ult AS (SELECT id, nome_peca, roteiro, estado, criado_em FROM j ORDER BY criado_em DESC, id DESC LIMIT 1)
  SELECT jsonb_build_object(
    'em_andamento', (SELECT count(*) FROM j WHERE estado IN ('na_fila','analisando','aplicando')),
    'aguardando_aprovacao', (SELECT count(*) FROM j WHERE estado = 'aguardando_aprovacao'),
    'analises_total', (SELECT count(*) FROM j),
    'analises_mes', (SELECT count(*) FROM j WHERE criado_em >= (SELECT ini FROM mes)),
    'otimizados', (SELECT count(*) FROM j WHERE estado = 'concluido' AND roteiro IN ('config_geral','reduzir_tempo')),
    'segundos_economizados', (SELECT seg FROM eco),
    'gramas_economizadas', (SELECT g FROM eco_g),
    'checklists', (SELECT count(*) FROM j WHERE roteiro = 'checklist'),
    'precos', (SELECT count(*) FROM j WHERE roteiro = 'preco'),
    'erros_30d', (SELECT count(*) FROM j WHERE estado = 'erro' AND criado_em >= now() - interval '30 days'),
    'orc_enviados', (SELECT count(*) FROM o WHERE status = 'enviado'),
    'orc_aprovados', (SELECT count(*) FROM o WHERE status = 'aprovado'),
    'orc_recusados', (SELECT count(*) FROM o WHERE status = 'recusado'),
    'orc_aprovado_mes_centavos', (SELECT COALESCE(SUM(COALESCE(total_bigint, total_centavos)), 0) FROM o WHERE status = 'aprovado' AND criado_em >= (SELECT ini FROM mes)),
    'pecas', (SELECT count(*) FROM pecas WHERE user_id = (SELECT id FROM u)),
    'modelos', (SELECT count(*) FROM presets WHERE user_id = (SELECT id FROM u)),
    'api_usd_mes', (SELECT COALESCE(SUM((custo_real->>'usd')::numeric), 0) FROM j WHERE motor = 'api' AND criado_em >= (SELECT ini FROM mes) AND jsonb_typeof(custo_real->'usd') = 'number'),
    'assinatura_mes', (SELECT count(*) FROM j WHERE motor = 'assinatura' AND criado_em >= (SELECT ini FROM mes)),
    'usou_motor_proprio', EXISTS (SELECT 1 FROM j WHERE motor IN ('api','assinatura')),
    'ultima', (SELECT to_jsonb(ult) FROM ult)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.kpis_usuario() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kpis_usuario() TO authenticated;

CREATE OR REPLACE FUNCTION public.versao_num(v text) RETURNS int[] LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(array_agg(x::int ORDER BY o), '{}') FROM regexp_matches(COALESCE(v,''), '\d+', 'g') WITH ORDINALITY AS t(m, o), LATERAL (SELECT m[1]) s(x)
$$;

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
        'preco', count(*) FILTER (WHERE roteiro = 'preco')) FROM jobs WHERE criado_em >= ini),
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
REVOKE EXECUTE ON FUNCTION public.kpis_admin(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kpis_admin(text) TO authenticated;