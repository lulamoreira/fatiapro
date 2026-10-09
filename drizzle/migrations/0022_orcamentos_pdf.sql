CREATE TABLE public.negocio (
  user_id uuid PRIMARY KEY,
  nome text NOT NULL CHECK (char_length(btrim(nome)) BETWEEN 1 AND 120),
  documento text CHECK (documento IS NULL OR char_length(documento) <= 30),
  email text CHECK (email IS NULL OR char_length(email) <= 160),
  whatsapp text CHECK (whatsapp IS NULL OR char_length(whatsapp) <= 40),
  cidade text CHECK (cidade IS NULL OR char_length(cidade) <= 120),
  logo_path text CHECK (logo_path IS NULL OR char_length(logo_path) <= 300),
  proximo_numero int NOT NULL DEFAULT 1,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.negocio TO authenticated;
GRANT INSERT (user_id, nome, documento, email, whatsapp, cidade, logo_path) ON public.negocio TO authenticated;
GRANT UPDATE (nome, documento, email, whatsapp, cidade, logo_path, atualizado_em) ON public.negocio TO authenticated;
GRANT ALL ON public.negocio TO service_role;
ALTER TABLE public.negocio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "negocio_select_own" ON public.negocio FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "negocio_insert_own" ON public.negocio FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND (logo_path IS NULL OR starts_with(logo_path, auth.uid()::text || '/')));
CREATE POLICY "negocio_update_own" ON public.negocio FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND (logo_path IS NULL OR starts_with(logo_path, auth.uid()::text || '/')));

CREATE TABLE public.orcamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  numero int NOT NULL,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  cliente_nome text NOT NULL,
  cliente_contato text,
  descricao text NOT NULL,
  quantidade int NOT NULL CHECK (quantidade > 0),
  preco_unitario_centavos int NOT NULL CHECK (preco_unitario_centavos > 0),
  total_centavos int NOT NULL,
  prazo_entrega text,
  validade_dias int NOT NULL DEFAULT 7,
  forma_pagamento text,
  observacoes text,
  foto_path text,
  status text NOT NULL DEFAULT 'enviado' CHECK (status IN ('enviado','aprovado','recusado')),
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, numero)
);
CREATE INDEX orcamentos_user_criado_idx ON public.orcamentos (user_id, criado_em DESC, id DESC);
CREATE INDEX orcamentos_job_idx ON public.orcamentos (job_id);
GRANT SELECT ON public.orcamentos TO authenticated;
GRANT UPDATE (status) ON public.orcamentos TO authenticated;
GRANT ALL ON public.orcamentos TO service_role;
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orcamentos_select_own" ON public.orcamentos FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "orcamentos_update_own" ON public.orcamentos FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.criar_orcamento(
  p_cliente_nome text, p_cliente_contato text, p_descricao text, p_quantidade int,
  p_preco_unitario_centavos int, p_job_id uuid, p_prazo_entrega text, p_validade_dias int,
  p_forma_pagamento text, p_observacoes text, p_foto_path text)
RETURNS TABLE (id uuid, numero int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare v_uid uuid := auth.uid(); v_num int; v_id uuid;
begin
  if v_uid is null then raise exception 'nao_autenticado'; end if;
  if not exists (select 1 from public.negocio n where n.user_id = v_uid) then raise exception 'negocio_nao_configurado'; end if;
  if p_cliente_nome is null or char_length(btrim(p_cliente_nome)) = 0 or char_length(p_cliente_nome) > 120 then raise exception 'cliente_invalido'; end if;
  if p_descricao is null or char_length(btrim(p_descricao)) = 0 or char_length(p_descricao) > 120 then raise exception 'descricao_invalida'; end if;
  if char_length(coalesce(p_cliente_contato,'')) > 120 or char_length(coalesce(p_prazo_entrega,'')) > 120
     or char_length(coalesce(p_forma_pagamento,'')) > 120 then raise exception 'campo_longo'; end if;
  if char_length(coalesce(p_observacoes,'')) > 1000 then raise exception 'observacoes_longas'; end if;
  if p_quantidade is null or p_quantidade < 1 or p_quantidade > 100000 then raise exception 'quantidade_invalida'; end if;
  if p_preco_unitario_centavos is null or p_preco_unitario_centavos < 1 or p_preco_unitario_centavos > 100000000 then raise exception 'preco_invalido'; end if;
  if p_validade_dias is null or p_validade_dias < 1 or p_validade_dias > 365 then raise exception 'validade_invalida'; end if;
  if p_foto_path is not null and (char_length(p_foto_path) > 300 or not starts_with(p_foto_path, v_uid::text || '/')) then raise exception 'foto_invalida'; end if;
  if p_job_id is not null and not exists (select 1 from public.jobs j where j.id = p_job_id and j.user_id = v_uid) then raise exception 'analise_invalida'; end if;
  update public.negocio n set proximo_numero = n.proximo_numero + 1 where n.user_id = v_uid returning n.proximo_numero - 1 into v_num;
  insert into public.orcamentos (user_id, numero, job_id, cliente_nome, cliente_contato, descricao, quantidade,
    preco_unitario_centavos, total_centavos, prazo_entrega, validade_dias, forma_pagamento, observacoes, foto_path)
  values (v_uid, v_num, p_job_id, btrim(p_cliente_nome), nullif(btrim(coalesce(p_cliente_contato,'')),''), btrim(p_descricao), p_quantidade,
    p_preco_unitario_centavos, p_quantidade * p_preco_unitario_centavos, nullif(btrim(coalesce(p_prazo_entrega,'')),''), p_validade_dias,
    nullif(btrim(coalesce(p_forma_pagamento,'')),''), nullif(btrim(coalesce(p_observacoes,'')),''), p_foto_path)
  returning orcamentos.id into v_id;
  return query select v_id, v_num;
end $$;
REVOKE EXECUTE ON FUNCTION public.criar_orcamento(text,text,text,int,int,uuid,text,int,text,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.criar_orcamento(text,text,text,int,int,uuid,text,int,text,text,text) TO authenticated;

CREATE POLICY "negocio_obj_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'negocio' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "negocio_obj_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'negocio' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "negocio_obj_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'negocio' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "negocio_obj_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'negocio' AND (storage.foldername(name))[1] = auth.uid()::text);