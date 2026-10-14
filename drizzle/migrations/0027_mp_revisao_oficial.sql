ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS status_detail text;

CREATE TABLE public.pagamentos_duplicados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  payment_id text NOT NULL UNIQUE,
  valor_centavos integer NOT NULL,
  reembolsado_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.pagamentos_duplicados TO service_role;
ALTER TABLE public.pagamentos_duplicados ENABLE ROW LEVEL SECURITY;
CREATE INDEX pagamentos_duplicados_pedido_idx ON public.pagamentos_duplicados (pedido_id);

CREATE INDEX IF NOT EXISTS mp_eventos_dedupe_idx ON public.mp_eventos (payment_id, motivo, criado_em DESC);

ALTER TABLE public.admin_audit DROP CONSTRAINT IF EXISTS admin_audit_acao_check;
ALTER TABLE public.admin_audit ADD CONSTRAINT admin_audit_acao_check CHECK (acao IN ('bloquear','desbloquear','tornar_admin','remover_admin','dar_creditos','ajustar_creditos','remover_creditos','dar_cortesia','encerrar_cortesia','reiniciar_teste','config_cobranca','ponte_publicada_por_assinatura','pacote_criado','pacote_editado','cupom_criado','cupom_editado','cupom_desativado','resetou_proprio_aceite_termos','vendas_config','pedido_reembolsado'));