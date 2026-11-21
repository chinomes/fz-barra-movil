-- Ejecutar en Supabase > SQL Editor.
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 60),
  rating integer not null check (rating between 1 and 5),
  comment text not null check (char_length(comment) between 12 and 700),
  visible boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table if not exists public.budget_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  event text not null check (char_length(btrim(event)) between 3 and 120),
  date date,
  guests integer check (guests between 1 and 5000),
  whatsapp text not null default '' check (char_length(whatsapp) <= 40),
  email text not null default '' check (char_length(email) <= 254),
  details text not null default '' check (char_length(details) <= 1000),
  created_at timestamptz not null default now(),
  constraint budget_requests_contact_required check (
    nullif(btrim(whatsapp), '') is not null or nullif(btrim(email), '') is not null
  )
);

alter table public.reviews enable row level security;
alter table public.admin_users enable row level security;
alter table public.budget_requests enable row level security;

-- Cualquiera puede enviar una opinión; el público solo ve las opiniones visibles.
drop policy if exists "Anyone can submit a review" on public.reviews;
create policy "Anyone can submit a review" on public.reviews
  for insert to anon, authenticated with check (true);

drop policy if exists "Public can read visible reviews" on public.reviews;
create policy "Public can read visible reviews" on public.reviews
  for select to anon, authenticated using (visible = true);

-- El administrador autenticado puede ver todas y cambiar su visibilidad.
drop policy if exists "Admins can read all reviews" on public.reviews;
create policy "Admins can read all reviews" on public.reviews
  for select to authenticated using (
    exists (select 1 from public.admin_users a where a.user_id = auth.uid())
  );

drop policy if exists "Admins can update reviews" on public.reviews;
create policy "Admins can update reviews" on public.reviews
  for update to authenticated using (
    exists (select 1 from public.admin_users a where a.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.admin_users a where a.user_id = auth.uid())
  );

drop policy if exists "Admins can read own admin row" on public.admin_users;
create policy "Admins can read own admin row" on public.admin_users
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "Anyone can submit a budget request" on public.budget_requests;
create policy "Anyone can submit a budget request" on public.budget_requests
  for insert to anon, authenticated with check (true);

drop policy if exists "Admins can read budget requests" on public.budget_requests;
create policy "Admins can read budget requests" on public.budget_requests
  for select to authenticated using (
    exists (select 1 from public.admin_users a where a.user_id = auth.uid())
  );

-- Después de crear un usuario en Authentication > Users, agregá su UUID acá:
-- insert into public.admin_users (user_id) values ('PEGAR-UUID-DEL-USUARIO');

-- Permisos explícitos de tabla para los roles usados por el sitio.
grant usage on schema public to anon, authenticated;
grant insert on public.reviews to anon, authenticated;
grant select on public.reviews to anon, authenticated;
grant update on public.reviews to authenticated;
grant select on public.admin_users to authenticated;
grant insert on public.budget_requests to anon, authenticated;
grant select on public.budget_requests to authenticated;
