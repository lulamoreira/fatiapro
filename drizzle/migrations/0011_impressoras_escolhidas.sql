CREATE OR REPLACE FUNCTION public.impressoras_escolhidas_valido(v jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT jsonb_typeof(v) = 'object' AND NOT EXISTS (
    SELECT 1 FROM jsonb_each(v) e
    WHERE jsonb_typeof(e.value) <> 'array'
       OR jsonb_array_length(e.value) > 100
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(e.value) x
                  WHERE jsonb_typeof(x) <> 'string' OR length(x #>> '{}') > 200)
  )
$$;
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS impressoras_escolhidas jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.devices ADD CONSTRAINT devices_impressoras_escolhidas_chk CHECK (public.impressoras_escolhidas_valido(impressoras_escolhidas));
GRANT SELECT (impressoras_escolhidas), UPDATE (impressoras_escolhidas) ON public.devices TO authenticated;