CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v text := CASE WHEN new.raw_user_meta_data->>'termos_versao' = '1.0' THEN '1.0' ELSE NULL END;
BEGIN
  INSERT INTO public.profiles (id, nome, termos_versao, termos_aceitos_em)
  VALUES (new.id, coalesce(new.raw_user_meta_data->>'nome', new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
          v, CASE WHEN v IS NOT NULL THEN now() END)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END $function$;