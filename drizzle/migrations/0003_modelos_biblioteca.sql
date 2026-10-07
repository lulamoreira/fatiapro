create unique index if not exists presets_user_nome_uniq on public.presets(user_id, nome);

create table public.pecas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  nome text not null check (char_length(nome) between 1 and 120),
  arquivo_original_path text,
  arquivo_otimizado_path text,
  job_id uuid references public.jobs(id) on delete set null,
  observacao text check (observacao is null or char_length(observacao) <= 1000),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index pecas_user_idx on public.pecas(user_id, criado_em desc, id desc);
create index pecas_job_idx on public.pecas(job_id);
grant select, insert, update, delete on public.pecas to authenticated;
grant all on public.pecas to service_role;
alter table public.pecas enable row level security;
create policy "pecas_select_own" on public.pecas for select to authenticated using (auth.uid() = user_id);
create policy "pecas_insert_own" on public.pecas for insert to authenticated with check (
  auth.uid() = user_id
  and (arquivo_original_path is null or starts_with(arquivo_original_path, auth.uid()::text || '/'))
  and (arquivo_otimizado_path is null or starts_with(arquivo_otimizado_path, auth.uid()::text || '/'))
  and (job_id is null or exists (select 1 from public.jobs j where j.id = job_id and j.user_id = auth.uid()))
);
create policy "pecas_update_own" on public.pecas for update to authenticated using (auth.uid() = user_id) with check (
  auth.uid() = user_id
  and (arquivo_original_path is null or starts_with(arquivo_original_path, auth.uid()::text || '/'))
  and (arquivo_otimizado_path is null or starts_with(arquivo_otimizado_path, auth.uid()::text || '/'))
  and (job_id is null or exists (select 1 from public.jobs j where j.id = job_id and j.user_id = auth.uid()))
);
create policy "pecas_delete_own" on public.pecas for delete to authenticated using (auth.uid() = user_id);
create trigger pecas_touch before update on public.pecas for each row execute function public.touch_atualizado_em();

drop policy if exists "jobs_insert_own" on public.jobs;
create policy "jobs_insert_own" on public.jobs for insert to authenticated with check (
  auth.uid() = user_id and estado = 'na_fila'
  and (arquivo_path is null or starts_with(arquivo_path, auth.uid()::text || '/'))
  and (device_id is null or exists (select 1 from public.devices d where d.id = device_id and d.user_id = auth.uid() and not d.revogado))
);