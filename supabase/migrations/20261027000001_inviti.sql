-- Fase 0: registrazione solo su invito.
-- Chi non è in public.inviti non può creare un account, né con email né con Google:
-- lo impedisce l'hook "Before User Created" di Supabase Auth (da attivare nel pannello,
-- Authentication → Hooks, vedi docs/AVVIO-LOCALE.md).

create table public.inviti (
  email text primary key check (email = lower(email)),
  amministratore boolean not null default false,
  invitato_da uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.inviti is
  'Email autorizzate a registrarsi. Solo gli amministratori possono aggiungerne.';

alter table public.inviti enable row level security;

-- L'utente collegato è amministratore?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.inviti i
    where i.email = lower(coalesce(auth.jwt() ->> 'email', ''))
      and i.amministratore
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Ognuno vede il proprio invito; l'amministratore li vede tutti e li gestisce.
create policy "inviti: lettura propria o admin" on public.inviti
  for select to authenticated
  using (email = lower(auth.jwt() ->> 'email') or public.is_admin());

create policy "inviti: inserimento admin" on public.inviti
  for insert to authenticated
  with check (public.is_admin());

create policy "inviti: eliminazione admin" on public.inviti
  for delete to authenticated
  using (public.is_admin() and not amministratore);

-- Hook Before User Created: blocca le registrazioni senza invito.
create or replace function public.hook_solo_su_invito(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  email_utente text := lower(coalesce(event -> 'user' ->> 'email', ''));
begin
  if exists (select 1 from public.inviti where email = email_utente) then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'Registrazione solo su invito: questo indirizzo email non è stato invitato.'
    )
  );
end;
$$;

revoke execute on function public.hook_solo_su_invito(jsonb) from public, anon, authenticated;
grant execute on function public.hook_solo_su_invito(jsonb) to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;
