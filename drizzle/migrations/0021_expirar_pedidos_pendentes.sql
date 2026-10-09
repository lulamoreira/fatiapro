CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE OR REPLACE FUNCTION public.expirar_pedidos_pendentes()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare n int;
begin
  update public.pedidos set status = 'expirado'
   where status = 'pendente' and criado_em < now() - interval '3 hours';
  get diagnostics n = row_count;
  return n;
end $$;
REVOKE EXECUTE ON FUNCTION public.expirar_pedidos_pendentes() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expirar_pedidos_pendentes() TO service_role;