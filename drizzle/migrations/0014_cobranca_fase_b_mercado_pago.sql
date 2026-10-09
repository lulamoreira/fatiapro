CREATE TABLE public.pacotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL CHECK (char_length(btrim(nome)) BETWEEN 1 AND 80),
  creditos int NOT NULL CHECK (creditos > 0),
  preco_centavos int NOT NULL CHECK (preco_centavos > 0),
  validade_meses int NOT NULL DEFAULT 12 CHECK (validade_meses BETWEEN 1 AND 60),
  destaque boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pacotes TO authenticated;
GRANT ALL ON public.pacotes TO service_role;
ALTER TABLE public.pacotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY pacotes_select_ativos ON public.pacotes FOR SELECT TO authenticated USING (ativo OR public.is_admin());
INSERT INTO public.pacotes (nome, creditos, preco_centavos, destaque, ordem) VALUES
  ('10 créditos', 10, 1990, false, 1), ('50 créditos', 50, 7990, true, 2), ('200 créditos', 200, 24990, false, 3);

CREATE TABLE public.pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pacote_id uuid NOT NULL REFERENCES public.pacotes(id),
  creditos int NOT NULL CHECK (creditos > 0),
  valor_centavos int NOT NULL CHECK (valor_centavos > 0),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','recusado','cancelado','estornado','expirado')),
  mp_preference_id text,
  mp_payment_id text UNIQUE,
  metodo text,
  lote_id uuid REFERENCES public.creditos_lotes(id),
  criado_em timestamptz NOT NULL DEFAULT now(),
  pago_em timestamptz,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pedidos_user_idx ON public.pedidos (user_id, criado_em DESC, id DESC);
CREATE INDEX pedidos_status_idx ON public.pedidos (status, criado_em DESC);
GRANT SELECT ON public.pedidos TO authenticated;
GRANT ALL ON public.pedidos TO service_role;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY pedidos_select_own ON public.pedidos FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER pedidos_touch BEFORE UPDATE ON public.pedidos FOR EACH ROW EXECUTE FUNCTION public.touch_atualizado_em();

CREATE TABLE public.mp_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id text,
  status text,
  valido boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mp_eventos_criado_idx ON public.mp_eventos (criado_em DESC, id DESC);
GRANT ALL ON public.mp_eventos TO service_role;
ALTER TABLE public.mp_eventos ENABLE ROW LEVEL SECURITY;

INSERT INTO public.config_app (chave, valor) VALUES ('taxa_pix_pct', '1'::jsonb), ('taxa_cartao_pct', '5'::jsonb)
  ON CONFLICT (chave) DO NOTHING;

CREATE OR REPLACE FUNCTION public.creditar_pedido(p_pedido uuid, p_payment_id text, p_metodo text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare p record; v_meses int; v_lote uuid;
begin
  select * into p from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'pedido_inexistente'; end if;
  if p.status in ('aprovado','estornado') then return p.lote_id; end if;
  select validade_meses into v_meses from public.pacotes where id = p.pacote_id;
  insert into public.creditos_lotes (user_id, origem, quantidade, restante, expira_em, referencia)
  values (p.user_id, 'compra', p.creditos, p.creditos, now() + make_interval(months => coalesce(v_meses, 12)), 'mp:' || p_payment_id)
  returning id into v_lote;
  insert into public.creditos_movimentos (user_id, tipo, quantidade, lote_id, motivo)
  values (p.user_id, 'entrada', p.creditos, v_lote, 'mp:' || p_payment_id);
  update public.pedidos set status = 'aprovado', pago_em = now(), mp_payment_id = p_payment_id, metodo = p_metodo, lote_id = v_lote
   where id = p_pedido;
  return v_lote;
end $$;

CREATE OR REPLACE FUNCTION public.estornar_pedido(p_pedido uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare p record; l record;
begin
  select * into p from public.pedidos where id = p_pedido for update;
  if not found or p.status <> 'aprovado' then return; end if;
  perform pg_advisory_xact_lock(hashtext('criar_analise:' || p.user_id::text));
  select id, restante into l from public.creditos_lotes where id = p.lote_id for update;
  if found and l.restante > 0 then
    update public.creditos_lotes set restante = 0 where id = l.id;
    insert into public.creditos_movimentos (user_id, tipo, quantidade, lote_id, motivo)
    values (p.user_id, 'ajuste', -l.restante, l.id, coalesce(nullif(btrim(p_motivo), ''), 'estorno do pagamento'));
  end if;
  update public.pedidos set status = 'estornado' where id = p_pedido;
end $$;

REVOKE ALL ON FUNCTION public.creditar_pedido(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.estornar_pedido(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.creditar_pedido(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.estornar_pedido(uuid, text) TO service_role;

ALTER TABLE public.admin_audit DROP CONSTRAINT IF EXISTS admin_audit_acao_check;
ALTER TABLE public.admin_audit ADD CONSTRAINT admin_audit_acao_check CHECK (acao IN (
  'bloquear','desbloquear','tornar_admin','remover_admin',
  'dar_creditos','ajustar_creditos','remover_creditos','dar_cortesia','encerrar_cortesia','reiniciar_teste','config_cobranca',
  'ponte_publicada_por_assinatura','pacote_criado','pacote_editado'));