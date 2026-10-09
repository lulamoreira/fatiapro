ALTER TABLE public.ponte_versoes ADD COLUMN IF NOT EXISTS publicada_por_assinatura boolean NOT NULL DEFAULT false;
GRANT SELECT (publicada_por_assinatura) ON public.ponte_versoes TO authenticated;