ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS termos_versao text CHECK (termos_versao IS NULL OR length(termos_versao) <= 20), ADD COLUMN IF NOT EXISTS termos_aceitos_em timestamptz;
GRANT SELECT ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare v text := left(nullif(new.raw_user_meta_data->>'termos_versao',''), 20);
begin
  insert into public.profiles (id, nome, termos_versao, termos_aceitos_em)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
          v, case when v is not null then now() end)
  on conflict (id) do nothing;
  return new;
end $$;

CREATE OR REPLACE FUNCTION public.aceitar_termos(p_versao text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if auth.uid() is null then raise exception 'nao_autenticado'; end if;
  if p_versao is null or length(p_versao) = 0 or length(p_versao) > 20 then raise exception 'versao_invalida'; end if;
  insert into public.profiles (id, termos_versao, termos_aceitos_em) values (auth.uid(), p_versao, now())
  on conflict (id) do update set termos_versao = excluded.termos_versao, termos_aceitos_em = excluded.termos_aceitos_em;
end $$;
REVOKE ALL ON FUNCTION public.aceitar_termos(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aceitar_termos(text) TO authenticated;