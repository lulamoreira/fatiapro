alter table public.devices add column if not exists usos_claude text[] not null default '{}';
grant select (usos_claude) on public.devices to authenticated;
grant update (usos_claude) on public.devices to authenticated;

create table public.device_commands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  tipo text not null check (tipo in ('instalar_claude_code','entrar_claude','configurar_api','escolher_pasta')),
  parametros jsonb not null default '{}'::jsonb,
  estado text not null default 'pendente' check (estado in ('pendente','executando','concluido','erro')),
  resposta jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index device_commands_user_idx on public.device_commands(user_id, criado_em desc, id desc);
create index device_commands_device_estado_idx on public.device_commands(device_id, estado, criado_em);
grant select on public.device_commands to authenticated;
grant insert (device_id, tipo, parametros) on public.device_commands to authenticated;
grant all on public.device_commands to service_role;
alter table public.device_commands enable row level security;
create policy "device_commands_select_own" on public.device_commands for select to authenticated using (auth.uid() = user_id);
create policy "device_commands_insert_own" on public.device_commands for insert to authenticated with check (
  auth.uid() = user_id and estado = 'pendente'
  and exists (select 1 from public.devices d where d.id = device_id and d.user_id = auth.uid() and not d.revogado)
);
create trigger device_commands_touch before update on public.device_commands for each row execute function public.touch_atualizado_em();
alter publication supabase_realtime add table public.device_commands;

create or replace function public.claim_next_command(p_device_id uuid)
returns setof public.device_commands
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select c.id into v_id from public.device_commands c
   where c.device_id = p_device_id and c.estado = 'pendente'
   order by c.criado_em asc, c.id asc
   for update skip locked limit 1;
  if v_id is null then return; end if;
  return query update public.device_commands set estado = 'executando' where id = v_id returning *;
end $$;
revoke all on function public.claim_next_command(uuid) from public, anon, authenticated;
grant execute on function public.claim_next_command(uuid) to service_role;