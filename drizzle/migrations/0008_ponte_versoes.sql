CREATE TABLE public.ponte_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plataforma text NOT NULL CHECK (plataforma IN ('macos','windows')),
  versao text NOT NULL CHECK (versao ~ '^\d+\.\d+\.\d+$'),
  arquivo_path text NOT NULL,
  nome_arquivo text NOT NULL,
  tamanho_bytes bigint NOT NULL CHECK (tamanho_bytes > 0),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  assinatura text NOT NULL,
  notas text,
  publicada boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plataforma, versao)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ponte_versoes TO authenticated;
GRANT ALL ON public.ponte_versoes TO service_role;
ALTER TABLE public.ponte_versoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY ponte_versoes_select ON public.ponte_versoes FOR SELECT TO authenticated USING (publicada OR public.is_admin());
CREATE POLICY ponte_versoes_insert_admin ON public.ponte_versoes FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY ponte_versoes_update_admin ON public.ponte_versoes FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY ponte_versoes_delete_admin ON public.ponte_versoes FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY ponte_admin_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ponte' AND public.is_admin() AND lower(name) ~ '\.(pkg|exe)$');
CREATE POLICY ponte_admin_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ponte' AND public.is_admin());