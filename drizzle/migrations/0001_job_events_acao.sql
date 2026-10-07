alter table public.job_events drop constraint if exists job_events_tipo_check;
alter table public.job_events add constraint job_events_tipo_check check (tipo in ('progresso','proposta','aprovacao','pedido_outra','resultado','erro','cancelamento','acao'));
drop policy if exists "job_events_insert_own" on public.job_events;
create policy "job_events_insert_own" on public.job_events for insert to authenticated
  with check (tipo in ('aprovacao','pedido_outra','cancelamento','acao')
    and exists (select 1 from public.jobs j where j.id = job_id and j.user_id = auth.uid()));