create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  criado_em timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  nome text not null,
  sistema text not null check (sistema in ('macos','windows')),
  versao_ponte text,
  ultimo_contato timestamptz,
  relatorio jsonb not null default '{}'::jsonb,
  limite_gasto_usd numeric not null default 2.00 check (limite_gasto_usd >= 0),
  token_hash text not null unique,
  revogado boolean not null default false,
  criado_em timestamptz not null default now()
);
create index devices_user_id_idx on public.devices(user_id);
grant select (id, user_id, nome, sistema, versao_ponte, ultimo_contato, relatorio, limite_gasto_usd, revogado, criado_em) on public.devices to authenticated;
grant update (nome, limite_gasto_usd, revogado) on public.devices to authenticated;
grant all on public.devices to service_role;
alter table public.devices enable row level security;
create policy "devices_select_own" on public.devices for select to authenticated using (auth.uid() = user_id);
create policy "devices_update_own" on public.devices for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.pairing_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  codigo_hash text not null,
  expira_em timestamptz not null,
  usado boolean not null default false,
  criado_em timestamptz not null default now()
);
create index pairing_codes_hash_idx on public.pairing_codes(codigo_hash);
grant all on public.pairing_codes to service_role;
alter table public.pairing_codes enable row level security;

create table public.pair_attempts (
  id uuid primary key default gen_random_uuid(),
  ip text not null,
  criado_em timestamptz not null default now()
);
create index pair_attempts_ip_idx on public.pair_attempts(ip, criado_em);
grant all on public.pair_attempts to service_role;
alter table public.pair_attempts enable row level security;

create or replace function public.create_pairing_code()
returns table (codigo text, expira_em timestamptz)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_exp timestamptz := now() + interval '10 minutes';
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  v_code := lpad(((('x' || encode(extensions.gen_random_bytes(4),'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');
  update public.pairing_codes pc set usado = true where pc.user_id = v_uid and pc.usado = false;
  insert into public.pairing_codes (user_id, codigo_hash, expira_em)
  values (v_uid, encode(extensions.digest(v_code, 'sha256'), 'hex'), v_exp);
  return query select v_code, v_exp;
end $$;
revoke all on function public.create_pairing_code() from public, anon;
grant execute on function public.create_pairing_code() to authenticated;

create table public.presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  nome text not null,
  opcoes jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);
create index presets_user_id_idx on public.presets(user_id);
grant select, insert, update, delete on public.presets to authenticated;
grant all on public.presets to service_role;
alter table public.presets enable row level security;
create policy "presets_all_own" on public.presets for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  device_id uuid references public.devices(id) on delete cascade,
  roteiro text not null check (roteiro in ('config_geral','reduzir_tempo','checklist','preco')),
  fatiador text check (fatiador in ('bambu','orca','snapmaker','anycubic')),
  opcoes jsonb not null default '{}'::jsonb,
  motor text not null check (motor in ('assinatura','api')),
  estado text not null default 'na_fila' check (estado in ('na_fila','analisando','aguardando_aprovacao','aplicando','concluido','erro','cancelado','limite_de_gasto')),
  arquivo_path text,
  nome_peca text,
  resultado jsonb,
  custo_real jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index jobs_user_id_idx on public.jobs(user_id, criado_em desc, id desc);
create index jobs_device_estado_idx on public.jobs(device_id, estado, criado_em);
grant select on public.jobs to authenticated;
grant insert (device_id, roteiro, fatiador, opcoes, motor, arquivo_path, nome_peca) on public.jobs to authenticated;
grant update (estado) on public.jobs to authenticated;
grant all on public.jobs to service_role;
alter table public.jobs enable row level security;
create policy "jobs_select_own" on public.jobs for select to authenticated using (auth.uid() = user_id);
create policy "jobs_insert_own" on public.jobs for insert to authenticated with check (
  auth.uid() = user_id and estado = 'na_fila'
  and (device_id is null or exists (select 1 from public.devices d where d.id = device_id and d.user_id = auth.uid() and not d.revogado))
);
create policy "jobs_cancel_own" on public.jobs for update to authenticated
  using (auth.uid() = user_id and estado <> 'concluido')
  with check (auth.uid() = user_id and estado = 'cancelado');

create or replace function public.touch_atualizado_em() returns trigger language plpgsql set search_path = public as $$
begin new.atualizado_em := now(); return new; end $$;
create trigger jobs_touch before update on public.jobs for each row execute function public.touch_atualizado_em();

create table public.job_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  tipo text not null check (tipo in ('progresso','proposta','aprovacao','pedido_outra','resultado','erro','cancelamento')),
  conteudo jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);
create index job_events_job_idx on public.job_events(job_id, criado_em);
grant select on public.job_events to authenticated;
grant insert (job_id, tipo, conteudo) on public.job_events to authenticated;
grant all on public.job_events to service_role;
alter table public.job_events enable row level security;
create policy "job_events_select_own" on public.job_events for select to authenticated
  using (exists (select 1 from public.jobs j where j.id = job_id and j.user_id = auth.uid()));
create policy "job_events_insert_own" on public.job_events for insert to authenticated
  with check (tipo in ('aprovacao','pedido_outra','cancelamento')
    and exists (select 1 from public.jobs j where j.id = job_id and j.user_id = auth.uid()));

create table public.price_table (
  modelo text primary key,
  preco_entrada_usd_por_milhao numeric not null,
  preco_saida_usd_por_milhao numeric not null,
  atualizado_em timestamptz not null default now()
);
grant select on public.price_table to authenticated;
grant all on public.price_table to service_role;
alter table public.price_table enable row level security;
create policy "price_table_read" on public.price_table for select to authenticated using (true);

create table public.estimativas_roteiro (
  roteiro text primary key check (roteiro in ('config_geral','reduzir_tempo','checklist','preco')),
  fatiamentos_tipicos int not null,
  tokens_entrada_tipicos int not null,
  tokens_saida_tipicos int not null
);
grant select on public.estimativas_roteiro to authenticated;
grant all on public.estimativas_roteiro to service_role;
alter table public.estimativas_roteiro enable row level security;
create policy "estimativas_read" on public.estimativas_roteiro for select to authenticated using (true);
insert into public.estimativas_roteiro values
  ('config_geral',8,60000,6000),('reduzir_tempo',6,45000,4000),('checklist',2,20000,3000),('preco',0,5000,2000);

create or replace function public.claim_next_job(p_device_id uuid)
returns setof public.jobs
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select j.id into v_id from public.jobs j
   where j.device_id = p_device_id and j.estado = 'na_fila'
   order by j.criado_em asc, j.id asc
   for update skip locked limit 1;
  if v_id is null then return; end if;
  return query update public.jobs set estado = 'analisando' where id = v_id returning *;
end $$;
revoke all on function public.claim_next_job(uuid) from public, anon, authenticated;
grant execute on function public.claim_next_job(uuid) to service_role;

alter table public.jobs replica identity full;
alter publication supabase_realtime add table public.jobs;
alter publication supabase_realtime add table public.job_events;
alter publication supabase_realtime add table public.devices;

create policy "pecas_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'pecas' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "pecas_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'pecas' and (storage.foldername(name))[1] = auth.uid()::text
    and lower(storage.extension(name)) in ('stl','3mf','step','stp'));
create policy "pecas_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'pecas' and (storage.foldername(name))[1] = auth.uid()::text);