CREATE TABLE public.cupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE CHECK (codigo ~ '^[A-Z0-9-]{3,30}$'),
  creditos int NOT NULL CHECK (creditos > 0 AND creditos <= 100000),
  validade_dias int NOT NULL DEFAULT 90 CHECK (validade_dias BETWEEN 1 AND 730),
  inicio timestamptz NOT NULL DEFAULT now(),
  fim timestamptz,
  limite_total int CHECK (limite_total IS NULL OR limite_total > 0),
  usos int NOT NULL DEFAULT 0 CHECK (usos >= 0),
  so_primeira_compra boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.cupons TO service_role;
ALTER TABLE public.cupons ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.cupom_usos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cupom_id uuid NOT NULL REFERENCES public.cupons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  lote_id uuid REFERENCES public.creditos_lotes(id),
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cupom_id, user_id)
);
CREATE INDEX cupom_usos_cupom_idx ON public.cupom_usos (cupom_id, criado_em DESC, id DESC);
GRANT ALL ON public.cupom_usos TO service_role;
ALTER TABLE public.cupom_usos ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.cupom_tentativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cupom_tentativas_user_idx ON public.cupom_tentativas (user_id, criado_em DESC);
GRANT ALL ON public.cupom_tentativas TO service_role;
ALTER TABLE public.cupom_tentativas ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.resgatar_cupom(p_user uuid, p_codigo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare c record; v_lote uuid; v_exp timestamptz;
begin
  select * into c from public.cupons where codigo = upper(btrim(coalesce(p_codigo, ''))) for update;
  if not found or not c.ativo then raise exception 'cupom_invalido'; end if;
  if now() < c.inicio or (c.fim is not null and now() > c.fim) then raise exception 'cupom_expirado'; end if;
  if c.limite_total is not null and c.usos >= c.limite_total then raise exception 'cupom_esgotado'; end if;
  if exists (select 1 from public.cupom_usos where cupom_id = c.id and user_id = p_user) then raise exception 'cupom_ja_usado'; end if;
  if c.so_primeira_compra and exists (select 1 from public.pedidos where user_id = p_user and status = 'aprovado') then
    raise exception 'cupom_so_primeira_compra'; end if;
  v_exp := now() + make_interval(days => c.validade_dias);
  insert into public.creditos_lotes (user_id, origem, quantidade, restante, expira_em, referencia)
  values (p_user, 'cupom', c.creditos, c.creditos, v_exp, 'cupom:' || c.codigo) returning id into v_lote;
  insert into public.creditos_movimentos (user_id, tipo, quantidade, lote_id, motivo)
  values (p_user, 'entrada', c.creditos, v_lote, 'cupom ' || c.codigo);
  insert into public.cupom_usos (cupom_id, user_id, lote_id) values (c.id, p_user, v_lote);
  update public.cupons set usos = usos + 1 where id = c.id;
  return jsonb_build_object('creditos', c.creditos, 'expira_em', v_exp);
end $$;
REVOKE ALL ON FUNCTION public.resgatar_cupom(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resgatar_cupom(uuid, text) TO service_role;

ALTER TABLE public.admin_audit DROP CONSTRAINT IF EXISTS admin_audit_acao_check;
ALTER TABLE public.admin_audit ADD CONSTRAINT admin_audit_acao_check CHECK (acao IN (
  'bloquear','desbloquear','tornar_admin','remover_admin',
  'dar_creditos','ajustar_creditos','remover_creditos','dar_cortesia','encerrar_cortesia','reiniciar_teste','config_cobranca',
  'ponte_publicada_por_assinatura','pacote_criado','pacote_editado',
  'cupom_criado','cupom_editado','cupom_desativado'));