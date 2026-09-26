-- =====================================================================
-- CareBridge — funcții de autorizare și politici Row Level Security
-- =====================================================================

-- ---------------------------------------------------------------------
-- Funcții ajutătoare (SECURITY DEFINER evită recursivitatea RLS)
-- ---------------------------------------------------------------------
create or replace function public.app_role()
returns public.user_role
language sql stable security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and is_active;
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.app_role() = 'admin', false);
$$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.app_role() in ('admin', 'caregiver'), false);
$$;

-- Utilizatorul curent face parte din echipa persoanei (sau este administrator)
create or replace function public.has_elder_access(p_elder uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_admin()
      or exists (
        select 1
        from public.elder_members m
        join public.profiles p on p.id = m.user_id
        where m.elder_id = p_elder and m.user_id = auth.uid() and p.is_active
      );
$$;

-- Utilizatorul curent și p_user au cel puțin o persoană asistată în comun
create or replace function public.shares_elder_with(p_user uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.elder_members a
    join public.elder_members b on a.elder_id = b.elder_id
    where a.user_id = auth.uid() and b.user_id = p_user
  );
$$;

-- ---------------------------------------------------------------------
-- Activare RLS
-- ---------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.elders          enable row level security;
alter table public.elder_members   enable row level security;
alter table public.care_activities enable row level security;
alter table public.observations    enable row level security;
alter table public.events          enable row level security;
alter table public.messages        enable row level security;
alter table public.message_reads   enable row level security;
alter table public.notifications   enable row level security;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin() or public.shares_elder_with(id));

create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
-- Rolul și starea contului sunt protejate de triggerul protect_profile_fields (003).

-- ---------------------------------------------------------------------
-- elders
-- ---------------------------------------------------------------------
create policy elders_select on public.elders for select to authenticated
  using (public.has_elder_access(id));

create policy elders_insert on public.elders for insert to authenticated
  with check (public.is_admin());

create policy elders_update on public.elders for update to authenticated
  using (public.is_admin() or (public.is_staff() and public.has_elder_access(id)))
  with check (public.is_admin() or (public.is_staff() and public.has_elder_access(id)));

create policy elders_delete on public.elders for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- elder_members
-- ---------------------------------------------------------------------
create policy members_select on public.elder_members for select to authenticated
  using (user_id = auth.uid() or public.has_elder_access(elder_id));

create policy members_admin_all on public.elder_members for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- care_activities — citire: toată echipa; scriere: îngrijitori și admin
-- ---------------------------------------------------------------------
create policy activities_select on public.care_activities for select to authenticated
  using (public.has_elder_access(elder_id));

create policy activities_insert on public.care_activities for insert to authenticated
  with check (public.is_staff() and public.has_elder_access(elder_id));

create policy activities_update on public.care_activities for update to authenticated
  using (public.is_staff() and public.has_elder_access(elder_id))
  with check (public.is_staff() and public.has_elder_access(elder_id));

create policy activities_delete on public.care_activities for delete to authenticated
  using (public.is_admin() or (created_by = auth.uid() and public.has_elder_access(elder_id)));

-- ---------------------------------------------------------------------
-- observations — orice membru al echipei poate consemna observații
-- ---------------------------------------------------------------------
create policy observations_select on public.observations for select to authenticated
  using (public.has_elder_access(elder_id));

create policy observations_insert on public.observations for insert to authenticated
  with check (public.has_elder_access(elder_id) and author_id = auth.uid());

create policy observations_update on public.observations for update to authenticated
  using (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() or public.is_admin());

create policy observations_delete on public.observations for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------
create policy events_select on public.events for select to authenticated
  using (public.has_elder_access(elder_id));

create policy events_insert on public.events for insert to authenticated
  with check (public.has_elder_access(elder_id) and created_by = auth.uid());

create policy events_update on public.events for update to authenticated
  using (created_by = auth.uid() or public.is_admin())
  with check (public.has_elder_access(elder_id));

create policy events_delete on public.events for delete to authenticated
  using (created_by = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------
create policy messages_select on public.messages for select to authenticated
  using (public.has_elder_access(elder_id));

create policy messages_insert on public.messages for insert to authenticated
  with check (public.has_elder_access(elder_id) and sender_id = auth.uid());

create policy messages_delete on public.messages for delete to authenticated
  using (sender_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------
-- message_reads — fiecare își gestionează propriile rânduri
-- ---------------------------------------------------------------------
create policy reads_own on public.message_reads for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.has_elder_access(elder_id));

-- ---------------------------------------------------------------------
-- notifications — create doar de triggere (SECURITY DEFINER)
-- ---------------------------------------------------------------------
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());

create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = auth.uid());
