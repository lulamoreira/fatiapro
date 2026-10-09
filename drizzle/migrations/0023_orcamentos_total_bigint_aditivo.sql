ALTER TABLE public.orcamentos ADD COLUMN total_bigint bigint;
UPDATE public.orcamentos SET total_bigint = total_centavos::bigint WHERE total_bigint IS NULL;
COMMENT ON COLUMN public.orcamentos.total_centavos IS 'DEPRECATED: replaced by total_bigint (this one is capped at int max)';

CREATE OR REPLACE FUNCTION public.criar_orcamento(p_cliente_nome text, p_cliente_contato text, p_descricao text, p_quantidade integer, p_preco_unitario_centavos integer, p_job_id uuid, p_prazo_entrega text, p_validade_dias integer, p_forma_pagamento text, p_observacoes text, p_foto_path text)
 RETURNS TABLE(id uuid, numero integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_uid uuid := auth.uid(); v_num int; v_id uuid; v_total bigint := p_quantidade::bigint * p_preco_unitario_centavos;
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
    preco_unitario_centavos, total_centavos, total_bigint, prazo_entrega, validade_dias, forma_pagamento, observacoes, foto_path)
  values (v_uid, v_num, p_job_id, btrim(p_cliente_nome), nullif(btrim(coalesce(p_cliente_contato,'')),''), btrim(p_descricao), p_quantidade,
    p_preco_unitario_centavos, least(v_total, 2147483647)::int, v_total, nullif(btrim(coalesce(p_prazo_entrega,'')),''), p_validade_dias,
    nullif(btrim(coalesce(p_forma_pagamento,'')),''), nullif(btrim(coalesce(p_observacoes,'')),''), p_foto_path)
  returning orcamentos.id into v_id;
  return query select v_id, v_num;
end $function$;