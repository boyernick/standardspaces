-- Applications (waitlist)
create table if not exists public.applications (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  email text not null unique,
  instagram text,
  reason text,
  referral text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now()
);

alter table public.applications enable row level security;
-- No public policies — only accessed via service-role key

-- Profiles (linked to auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('member', 'admin')),
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Auto-set admin role for Nick
create or replace function public.set_admin_role()
returns trigger as $$
begin
  if new.email = 'nickboyer.bizz@gmail.com' then
    new.role := 'admin';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger on_profile_created
  before insert on public.profiles
  for each row execute function public.set_admin_role();
