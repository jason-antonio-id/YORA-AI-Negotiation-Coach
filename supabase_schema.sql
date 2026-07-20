-- Supabase schema migration for YORA Negotiation Coach

-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- Admins Table
create table public.admins (
  email text primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Profiles Table (1:1 with auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  email text not null,
  business_name text,
  business_type text,
  province text,
  origin_city text,
  onboarding_status text default 'incomplete',
  is_suspended boolean default false,
  email_verified boolean default false,
  ai_lang text,
  ai_style text,
  ai_tone text,
  ai_depth text,
  notifications_enabled boolean default true,
  email_digest_enabled boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Suppliers Table
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users on delete cascade not null,
  chinese_name text not null,
  english_name text not null,
  wechat_id text,
  url text,
  province text,
  city text,
  discovery_source text,
  cooperation_history text,
  logo_url text,
  status text,
  core_products jsonb default '[]'::jsonb,
  guanxi_score integer default 50,
  guanxi_trend integer default 0,
  last_contact_text text,
  target_price text,
  walk_away_price text,
  moq text,
  product_name text,
  product_chinese_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Chat Messages Table
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers on delete cascade not null,
  sender text not null, -- 'user' or 'ai' / 'supplier'
  role text,
  sender_name text,
  text text not null,
  time_text text,
  translation text,
  analysis text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on all tables
alter table public.admins enable row level security;
alter table public.profiles enable row level security;
alter table public.suppliers enable row level security;
alter table public.chat_messages enable row level security;

-- Admin policies
create policy "Admins are only readable by authenticated users"
  on public.admins for select
  using (auth.uid() is not null);

-- Profiles policies
create policy "Users can view and edit their own profiles"
  on public.profiles for all
  using (auth.uid() = id);

create policy "Admins can view all profiles"
  on public.profiles for select
  using (exists (select 1 from public.admins where email = auth.jwt() ->> 'email'));

-- Suppliers policies
create policy "Users can CRUD their own suppliers"
  on public.suppliers for all
  using (auth.uid() = owner_id);

create policy "Admins can view all suppliers"
  on public.suppliers for select
  using (exists (select 1 from public.admins where email = auth.jwt() ->> 'email'));

-- Chat Messages policies
create policy "Users can CRUD messages of their owned suppliers"
  on public.chat_messages for all
  using (
    exists (
      select 1 from public.suppliers
      where public.suppliers.id = public.chat_messages.supplier_id
      and public.suppliers.owner_id = auth.uid()
    )
  );

create policy "Admins can view all messages"
  on public.chat_messages for select
  using (exists (select 1 from public.admins where email = auth.jwt() ->> 'email'));

-- Function and trigger to handle profile creation on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, onboarding_status, is_suspended)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    'incomplete',
    false
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Enable replication for realtime pub
alter table public.profiles replica identity full;
alter table public.suppliers replica identity full;
alter table public.chat_messages replica identity full;

-- Realtime Publication setup
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime for table public.profiles, public.suppliers, public.chat_messages;
commit;
