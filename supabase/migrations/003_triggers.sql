-- =====================================================================
-- CareBridge — triggere, notificări automate, funcții RPC, realtime
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Crearea profilului la înregistrare
--    Primul utilizator înregistrat devine administrator. Ceilalți își pot
--    alege doar rolul "family" sau "caregiver"; accesul la date apare abia
--    după ce administratorul îi adaugă în echipa unei persoane asistate.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_requested text := coalesce(new.raw_user_meta_data ->> 'role', 'family');
  v_language  text := coalesce(new.raw_user_meta_data ->> 'language', 'ro');
  v_role      public.user_role;
begin
  if not exists (select 1 from public.profiles) then
    v_role := 'admin';
  elsif v_requested in ('caregiver', 'family') then
    v_role := v_requested::public.user_role;
  else
    v_role := 'family';
  end if;

  if v_language not in ('ro', 'en', 'ru') then
    v_language := 'ro';
  end if;

  insert into public.profiles (id, full_name, email, phone, role, language)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data ->> 'phone',
    v_role,
    v_language
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 2. Doar administratorul poate schimba rolul sau activa/dezactiva conturi
--    (auth.uid() este null când se lucrează din SQL Editor — permis)
-- ---------------------------------------------------------------------
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role or new.is_active is distinct from old.is_active then
      raise exception 'Only an administrator can change role or account status'
        using errcode = '42501';
    end if;
  end if;
  new.email := old.email;  -- emailul se sincronizează doar din auth.users
  return new;
end;
$$;

create trigger profiles_protect_fields
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- ---------------------------------------------------------------------
-- 3. Funcție internă: trimite o notificare membrilor echipei unei persoane
-- ---------------------------------------------------------------------
create or replace function public.notify_members(
  p_elder   uuid,
  p_type    text,
  p_payload jsonb,
  p_link    text,
  p_exclude uuid default null,
  p_roles   public.user_role[] default null
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, payload, elder_id, link)
  select m.user_id, p_type, p_payload, p_elder, p_link
  from public.elder_members m
  join public.profiles p on p.id = m.user_id
  where m.elder_id = p_elder
    and p.is_active
    and (p_exclude is null or m.user_id <> p_exclude)
    and (p_roles is null or p.role = any (p_roles));
end;
$$;

revoke execute on function public.notify_members(uuid, text, jsonb, text, uuid, public.user_role[])
  from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Mesaje noi → notificare (grupată: un singur rând necitit pe fir)
-- ---------------------------------------------------------------------
create or replace function public.on_message_insert()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_sender text;
  v_elder  text;
  v_link   text := '/messages/' || new.elder_id;
begin
  select full_name into v_sender from public.profiles where id = new.sender_id;
  select full_name into v_elder  from public.elders   where id = new.elder_id;

  -- actualizează notificările necitite existente
  update public.notifications n
     set payload = n.payload || jsonb_build_object(
           'sender',  v_sender,
           'preview', left(new.content, 140),
           'count',   coalesce((n.payload ->> 'count')::int, 1) + 1),
         created_at = now()
   where n.elder_id = new.elder_id
     and n.type = 'new_message'
     and not n.is_read
     and n.user_id is distinct from new.sender_id;

  -- creează notificări pentru cei care nu au deja una necitită
  insert into public.notifications (user_id, type, payload, elder_id, link)
  select m.user_id, 'new_message',
         jsonb_build_object('sender', v_sender, 'elder', v_elder,
                            'preview', left(new.content, 140), 'count', 1),
         new.elder_id, v_link
  from public.elder_members m
  join public.profiles p on p.id = m.user_id
  where m.elder_id = new.elder_id
    and p.is_active
    and m.user_id is distinct from new.sender_id
    and not exists (
      select 1 from public.notifications n
      where n.user_id = m.user_id and n.elder_id = new.elder_id
        and n.type = 'new_message' and not n.is_read
    );

  return new;
end;
$$;

create trigger messages_after_insert
  after insert on public.messages
  for each row execute function public.on_message_insert();

-- ---------------------------------------------------------------------
-- 5. Evenimente noi → notificare (importante: incident, cădere, spitalizare
--    sau importanță high/critical)
-- ---------------------------------------------------------------------
create or replace function public.on_event_insert()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_important boolean := new.importance in ('high', 'critical')
                      or new.type in ('incident', 'fall', 'hospitalization');
begin
  perform public.notify_members(
    new.elder_id,
    case when v_important then 'important_event' else 'new_event' end,
    jsonb_build_object(
      'title',      new.title,
      'event_type', new.type,
      'importance', new.importance,
      'starts_at',  new.starts_at,
      'elder',      (select full_name from public.elders where id = new.elder_id),
      'author',     (select full_name from public.profiles where id = new.created_by)),
    '/events?focus=' || new.id,
    new.created_by);
  return new;
end;
$$;

create trigger events_after_insert
  after insert on public.events
  for each row execute function public.on_event_insert();

-- ---------------------------------------------------------------------
-- 6. Observații → detectarea automată a valorilor anormale
--    (pragurile sunt oglindite în src/lib/vitals.ts)
-- ---------------------------------------------------------------------
create or replace function public.observation_flags(o public.observations)
returns text[]
language sql immutable
as $$
  select array_remove(array[
    case when o.pain_level >= 7                         then 'pain'         end,
    case when o.systolic >= 180 or o.diastolic >= 110   then 'bp_high'      end,
    case when o.systolic < 90                           then 'bp_low'       end,
    case when o.heart_rate > 120                        then 'hr_high'      end,
    case when o.heart_rate < 45                         then 'hr_low'       end,
    case when o.temperature >= 38                       then 'fever'        end,
    case when o.temperature < 35                        then 'hypothermia'  end,
    case when o.oxygen_saturation < 92                  then 'spo2_low'     end,
    case when o.glucose > 250                           then 'glucose_high' end,
    case when o.glucose < 70                            then 'glucose_low'  end,
    case when o.mood = 'very_bad'                       then 'mood'         end
  ], null);
$$;

create or replace function public.on_observation_before()
returns trigger
language plpgsql
as $$
begin
  new.is_alert := coalesce(new.is_alert, false) or cardinality(public.observation_flags(new)) > 0;
  return new;
end;
$$;

create trigger observations_before_write
  before insert or update on public.observations
  for each row execute function public.on_observation_before();

create or replace function public.on_observation_insert()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.is_alert then
    perform public.notify_members(
      new.elder_id,
      'health_alert',
      jsonb_build_object(
        'elder',  (select full_name from public.elders where id = new.elder_id),
        'author', (select full_name from public.profiles where id = new.author_id),
        'flags',  to_jsonb(public.observation_flags(new)),
        'notes',  left(new.notes, 140)),
      '/elders/' || new.elder_id || '?tab=journal',
      new.author_id);
  end if;
  return new;
end;
$$;

create trigger observations_after_insert
  after insert on public.observations
  for each row execute function public.on_observation_insert();

-- ---------------------------------------------------------------------
-- 7. Activități de îngrijire
-- ---------------------------------------------------------------------

-- 7a. completarea automată a câmpurilor de finalizare
create or replace function public.on_activity_before_update()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'done' then
      new.completed_at := coalesce(new.completed_at, now());
      new.completed_by := coalesce(new.completed_by, auth.uid());
    elsif new.status = 'planned' then
      new.completed_at := null;
      new.completed_by := null;
      new.completion_notes := null;
    end if;
  end if;
  if new.scheduled_at is distinct from old.scheduled_at then
    new.reminder_sent := false;
  end if;
  return new;
end;
$$;

create trigger activities_before_update
  before update on public.care_activities
  for each row execute function public.on_activity_before_update();

-- 7b. activități noi → notificare către îngrijitorul desemnat
--     (la nivel de instrucțiune, ca o serie recurentă să genereze o singură notificare)
create or replace function public.on_activities_inserted()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, payload, elder_id, link)
  select g.assigned_to, 'activity_assigned',
         jsonb_build_object('title', g.title, 'elder', e.full_name,
                            'scheduled_at', g.first_at, 'count', g.cnt),
         g.elder_id, '/elders/' || g.elder_id || '?tab=plan'
  from (
    select assigned_to, elder_id, coalesce(series_id, id) as grp,
           min(title) as title, min(scheduled_at) as first_at, count(*) as cnt
    from new_rows
    where assigned_to is not null and assigned_to is distinct from auth.uid()
    group by assigned_to, elder_id, coalesce(series_id, id)
  ) g
  join public.elders e on e.id = g.elder_id;
  return null;
end;
$$;

create trigger activities_after_insert
  after insert on public.care_activities
  referencing new table as new_rows
  for each statement execute function public.on_activities_inserted();

-- 7c. schimbări de stare / reasignare
create or replace function public.on_activity_after_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_elder   text;
  v_payload jsonb;
  v_link    text := '/elders/' || new.elder_id || '?tab=plan';
begin
  select full_name into v_elder from public.elders where id = new.elder_id;
  v_payload := jsonb_build_object(
    'title', new.title, 'elder', v_elder, 'category', new.category,
    'scheduled_at', new.scheduled_at,
    'by', (select full_name from public.profiles where id = coalesce(new.completed_by, auth.uid())));

  if new.assigned_to is not null
     and new.assigned_to is distinct from old.assigned_to
     and new.assigned_to is distinct from auth.uid() then
    insert into public.notifications (user_id, type, payload, elder_id, link)
    values (new.assigned_to, 'activity_assigned', v_payload || '{"count":1}', new.elder_id, v_link);
  end if;

  if new.status is distinct from old.status then
    if new.status = 'done' then
      -- familia este informată despre activitățile realizate
      perform public.notify_members(new.elder_id, 'activity_done', v_payload, v_link,
                                    auth.uid(), array['family']::public.user_role[]);
    elsif new.status = 'missed' and new.scheduled_at > now() - interval '1 day' then
      perform public.notify_members(new.elder_id, 'activity_missed', v_payload, v_link, auth.uid());
    end if;
  end if;

  return new;
end;
$$;

create trigger activities_after_update
  after update on public.care_activities
  for each row execute function public.on_activity_after_update();

-- ---------------------------------------------------------------------
-- 8. Procesarea activităților scadente
--    • memento cu 30 de minute înainte
--    • marcare "ratată" la 2 ore după încheierea intervalului planificat
--    Rulată de pg_cron (004_cron.sql) și, ca rezervă, de client la fiecare 5 minute.
-- ---------------------------------------------------------------------
create or replace function public.process_due_activities()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_reminded int;
  v_missed   int;
begin
  with due as (
    update public.care_activities
       set reminder_sent = true
     where status = 'planned'
       and not reminder_sent
       and scheduled_at between now() and now() + interval '30 minutes'
    returning id, elder_id, assigned_to, title, scheduled_at
  ),
  recipients as (
    select d.elder_id, d.title, d.scheduled_at, d.assigned_to as user_id
    from due d
    where d.assigned_to is not null
    union
    select d.elder_id, d.title, d.scheduled_at, m.user_id
    from due d
    join public.elder_members m on m.elder_id = d.elder_id
    join public.profiles p on p.id = m.user_id and p.role = 'caregiver' and p.is_active
    where d.assigned_to is null
  )
  insert into public.notifications (user_id, type, payload, elder_id, link)
  select r.user_id, 'activity_reminder',
         jsonb_build_object('title', r.title, 'elder', e.full_name, 'scheduled_at', r.scheduled_at),
         r.elder_id, '/elders/' || r.elder_id || '?tab=plan'
  from recipients r
  join public.elders e on e.id = r.elder_id;
  get diagnostics v_reminded = row_count;

  update public.care_activities
     set status = 'missed'
   where status = 'planned'
     and scheduled_at + make_interval(mins => coalesce(duration_minutes, 30)) + interval '2 hours' < now();
  get diagnostics v_missed = row_count;

  return jsonb_build_object('reminders', v_reminded, 'missed', v_missed);
end;
$$;

revoke execute on function public.process_due_activities() from public, anon;
grant execute on function public.process_due_activities() to authenticated;

-- ---------------------------------------------------------------------
-- 9. Numărul de mesaje necitite pe fiecare fir (pentru utilizatorul curent)
-- ---------------------------------------------------------------------
create or replace function public.unread_message_counts()
returns table (elder_id uuid, unread bigint)
language sql stable security definer set search_path = public
as $$
  select m.elder_id, count(*)
  from public.messages m
  left join public.message_reads r
         on r.elder_id = m.elder_id and r.user_id = auth.uid()
  where public.has_elder_access(m.elder_id)
    and m.sender_id is distinct from auth.uid()
    and m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
  group by m.elder_id;
$$;

grant execute on function public.unread_message_counts() to authenticated;

-- ---------------------------------------------------------------------
-- 10. Realtime (mesaje, notificări și activități se actualizează live)
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['messages', 'notifications', 'care_activities'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;  -- already published
      when undefined_object then
        raise notice 'Publication supabase_realtime does not exist — skipping realtime setup';
        exit;
    end;
  end loop;
end;
$$;
