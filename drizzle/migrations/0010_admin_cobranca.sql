ALTER TABLE public.admin_audit DROP CONSTRAINT IF EXISTS admin_audit_acao_check;
ALTER TABLE public.admin_audit ADD CONSTRAINT admin_audit_acao_check CHECK (acao IN (
  'bloquear','desbloquear','tornar_admin','remover_admin',
  'dar_creditos','ajustar_creditos','remover_creditos','dar_cortesia','encerrar_cortesia','reiniciar_teste','config_cobranca'));

CREATE INDEX IF NOT EXISTS ia_chamadas_criado_idx ON public.ia_chamadas (criado_em DESC);
CREATE INDEX IF NOT EXISTS feedback_criado_idx ON public.feedback_respostas (criado_em DESC, id DESC);

CREATE OR REPLACE FUNCTION public.admin_dar_creditos(
  p_user uuid, p_qtd integer, p_origem text, p_validade_dias integer, p_motivo text, p_admin uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare v_lote uuid;
begin
  if p_qtd is null or p_qtd <= 0 then raise exception 'quantidade_invalida'; end if;
  if p_origem not in ('cortesia','ajuste') then raise exception 'origem_invalida'; end if;
  if p_validade_dias is null or p_validade_dias < 1 or p_validade_dias > 730 then raise exception 'validade_invalida'; end if;
  if p_motivo is null or char_length(btrim(p_motivo)) < 3 then raise exception 'motivo_obrigatorio'; end if;
  if p_admin is null then raise exception 'admin_obrigatorio'; end if;
  insert into public.creditos_lotes (user_id, origem, quantidade, restante, expira_em, referencia)
  values (p_user, p_origem, p_qtd, p_qtd, now() + make_interval(days => p_validade_dias), 'admin:' || p_admin::text)
  returning id into v_lote;
  insert into public.creditos_movimentos (user_id, tipo, quantidade, lote_id, motivo, admin_id)
  values (p_user, case when p_origem = 'ajuste' then 'ajuste' else 'entrada' end, p_qtd, v_lote, btrim(p_motivo), p_admin);
  return v_lote;
end $$;

CREATE OR REPLACE FUNCTION public.admin_remover_creditos(p_user uuid, p_qtd integer, p_motivo text, p_admin uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare r record; falta int := p_qtd; usa int; total int;
begin
  if p_qtd is null or p_qtd <= 0 then raise exception 'quantidade_invalida'; end if;
  if p_motivo is null or char_length(btrim(p_motivo)) < 3 then raise exception 'motivo_obrigatorio'; end if;
  if p_admin is null then raise exception 'admin_obrigatorio'; end if;
  perform pg_advisory_xact_lock(hashtext('criar_analise:' || p_user::text));
  select coalesce(sum(restante),0) into total from (
    select restante from public.creditos_lotes
     where user_id = p_user and restante > 0 and (expira_em is null or expira_em > now()) for update) s;
  if total < p_qtd then raise exception 'saldo_insuficiente'; end if;
  for r in select id, restante from public.creditos_lotes
            where user_id = p_user and restante > 0 and (expira_em is null or expira_em > now())
            order by expira_em desc nulls first, criado_em desc, id desc for update loop
    exit when falta = 0;
    usa := least(falta, r.restante);
    update public.creditos_lotes set restante = restante - usa where id = r.id;
    insert into public.creditos_movimentos (user_id, tipo, quantidade, lote_id, motivo, admin_id)
    values (p_user, 'ajuste', -usa, r.id, btrim(p_motivo), p_admin);
    falta := falta - usa;
  end loop;
end $$;

REVOKE EXECUTE ON FUNCTION public.admin_dar_creditos(uuid, integer, text, integer, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_remover_creditos(uuid, integer, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_dar_creditos(uuid, integer, text, integer, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_remover_creditos(uuid, integer, text, uuid) TO service_role;