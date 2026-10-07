CREATE TABLE public.admin_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  acao text NOT NULL CHECK (acao IN ('bloquear','desbloquear','tornar_admin','remover_admin')),
  alvo_user_id uuid NOT NULL,
  detalhe jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_audit TO service_role;
ALTER TABLE public.admin_audit ENABLE ROW LEVEL SECURITY;
CREATE INDEX admin_audit_criado_idx ON public.admin_audit (criado_em DESC, id DESC);
COMMENT ON TABLE public.admin_audit IS 'Admin action log. RLS on with no policies: service role only.';