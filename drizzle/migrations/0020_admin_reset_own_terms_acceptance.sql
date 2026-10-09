ALTER TABLE public.admin_audit DROP CONSTRAINT admin_audit_acao_check;
ALTER TABLE public.admin_audit ADD CONSTRAINT admin_audit_acao_check CHECK (acao = ANY (ARRAY['bloquear','desbloquear','tornar_admin','remover_admin','dar_creditos','ajustar_creditos','remover_creditos','dar_cortesia','encerrar_cortesia','reiniciar_teste','config_cobranca','ponte_publicada_por_assinatura','pacote_criado','pacote_editado','cupom_criado','cupom_editado','cupom_desativado','resetou_proprio_aceite_termos']::text[]));

CREATE OR REPLACE FUNCTION public.admin_resetar_meu_aceite()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE = '42501';
  END IF;
  UPDATE public.profiles SET termos_versao = NULL, termos_aceitos_em = NULL WHERE id = v_uid;
  INSERT INTO public.admin_audit (admin_id, acao, alvo_user_id, detalhe)
  VALUES (v_uid, 'resetou_proprio_aceite_termos', v_uid, '{}'::jsonb);
END $function$;
REVOKE EXECUTE ON FUNCTION public.admin_resetar_meu_aceite() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_resetar_meu_aceite() TO authenticated;