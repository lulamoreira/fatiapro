CREATE TABLE public.app_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_admins TO authenticated;
GRANT ALL ON public.app_admins TO service_role;
ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_admins_select_own ON public.app_admins FOR SELECT TO authenticated USING (auth.uid() = user_id);

INSERT INTO public.app_admins (user_id)
SELECT id FROM auth.users WHERE lower(email) = 'lula1973@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ select exists (select 1 from public.app_admins where user_id = auth.uid()) $$;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

DROP POLICY jobs_insert_own ON public.jobs;
CREATE POLICY jobs_insert_own ON public.jobs FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id AND estado = 'na_fila'
  AND (motor <> 'assinatura' OR public.is_admin())
  AND (arquivo_path IS NULL OR starts_with(arquivo_path, auth.uid()::text || '/'))
  AND (device_id IS NULL OR EXISTS (SELECT 1 FROM public.devices d WHERE d.id = jobs.device_id AND d.user_id = auth.uid() AND NOT d.revogado))
);

DROP POLICY device_commands_insert_own ON public.device_commands;
CREATE POLICY device_commands_insert_own ON public.device_commands FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id AND estado = 'pendente'
  AND (tipo NOT IN ('instalar_claude_code','entrar_claude') OR public.is_admin())
  AND EXISTS (SELECT 1 FROM public.devices d WHERE d.id = device_commands.device_id AND d.user_id = auth.uid() AND NOT d.revogado)
);