-- =========================================================================
-- Zulu Zenith Stock Take & Exchange — Initial Schema + RLS
-- Run via: supabase db push   (or paste into the Supabase SQL editor)
-- =========================================================================

-- ---------- Extensions ----------
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ---------- Enums ----------
create type public.user_role as enum ('staff', 'office', 'super_admin');
create type public.exchange_channel as enum ('In-store', 'Online');
create type public.exchange_type as enum ('Exchange', 'Return');

-- =========================================================================
-- TENANTS
-- =========================================================================
create table public.tenants (
  id           uuid primary key default gen_random_uuid(),
  company_name text not null,
  created_at   timestamptz not null default now()
);

-- =========================================================================
-- PROFILES  (1:1 with auth.users)
-- =========================================================================
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  tenant_id  uuid references public.tenants(id) on delete cascade, -- null only for super_admin
  role       public.user_role not null default 'staff',
  full_name  text not null,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  constraint tenant_required_unless_super_admin
    check (role = 'super_admin' or tenant_id is not null)
);

create index profiles_tenant_idx on public.profiles(tenant_id);

-- Auto-create a profile row whenever a new auth.users row appears.
-- Role/tenant/full_name are passed through signup metadata by whatever
-- provisioning flow creates the user (see README: admin-invite pattern).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, tenant_id, role, full_name)
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'tenant_id', '')::uuid,
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'staff'),
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- RLS helper functions ----------
-- SECURITY DEFINER + fixed search_path so these can be called inside RLS
-- policies on OTHER tables without triggering recursive-RLS evaluation
-- on `profiles` itself, and without being hijackable via search_path tricks.
create function public.current_tenant_id()
returns uuid
language sql
security definer set search_path = public
stable
as $$
  select tenant_id from public.profiles where id = auth.uid();
$$;

create function public.current_role()
returns public.user_role
language sql
security definer set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create function public.is_office_or_above()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select public.current_role() in ('office', 'super_admin');
$$;

grant execute on function public.current_tenant_id() to authenticated;
grant execute on function public.current_role() to authenticated;
grant execute on function public.is_office_or_above() to authenticated;

-- =========================================================================
-- PRODUCT CATALOG  (products + skus, tenant-scoped with a shared "master")
-- tenant_id = null  -> master/global catalog, managed by super_admin,
--                      readable by every tenant.
-- tenant_id = <uuid> -> a tenant's own catalog additions/overrides,
--                      managed by that tenant's office role.
-- =========================================================================
create table public.products (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid references public.tenants(id) on delete cascade, -- null = master catalog
  category   text not null,
  name       text not null,
  created_at timestamptz not null default now()
);

create table public.skus (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  colorway    text not null,
  color_hex   text,
  size        text not null,
  sku_code    text not null unique,
  created_at  timestamptz not null default now()
);

create index skus_product_idx on public.skus(product_id);

-- =========================================================================
-- STOCK TAKE SESSIONS + COUNTS
-- Each physical stock take is its own session so historical counts are
-- preserved rather than overwritten on the next count.
-- =========================================================================
create table public.stock_take_sessions (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  started_by uuid references public.profiles(id),
  started_at timestamptz not null default now(),
  closed_at  timestamptz
);

create table public.stock_counts (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.stock_take_sessions(id) on delete cascade,
  tenant_id     uuid not null references public.tenants(id) on delete cascade, -- denormalized for fast/simple RLS
  sku_id        uuid not null references public.skus(id) on delete cascade,
  counter_id    uuid references public.profiles(id),
  front_count   int check (front_count is null or front_count >= 0),
  boh_count     int check (boh_count is null or boh_count >= 0),
  notes         text,
  updated_at    timestamptz not null default now(),
  unique (session_id, sku_id)
);

create index stock_counts_session_idx on public.stock_counts(session_id);
create index stock_counts_tenant_idx  on public.stock_counts(tenant_id);

-- =========================================================================
-- EXCHANGE & RETURN LOGS
-- =========================================================================
create table public.exchange_logs (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  operator_id      uuid references public.profiles(id),
  order_number     text,
  customer_name    text,
  channel          public.exchange_channel not null,
  transaction_type public.exchange_type not null,
  items_in         jsonb not null default '[]'::jsonb, -- [{sku_code, size, colour}]
  items_out        jsonb not null default '[]'::jsonb,
  inspector_name   text,
  created_at       timestamptz not null default now()
);

create index exchange_logs_tenant_idx   on public.exchange_logs(tenant_id);
create index exchange_logs_operator_idx on public.exchange_logs(operator_id);

-- =========================================================================
-- ROW LEVEL SECURITY
-- =========================================================================
alter table public.tenants             enable row level security;
alter table public.profiles            enable row level security;
alter table public.products            enable row level security;
alter table public.skus                enable row level security;
alter table public.stock_take_sessions enable row level security;
alter table public.stock_counts        enable row level security;
alter table public.exchange_logs       enable row level security;

-- ---------- tenants ----------
create policy "super_admin reads all tenants" on public.tenants
  for select using (public.current_role() = 'super_admin');

create policy "members read own tenant" on public.tenants
  for select using (id = public.current_tenant_id());

create policy "super_admin manages tenants" on public.tenants
  for all using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');

-- ---------- profiles ----------
create policy "read own profile" on public.profiles
  for select using (id = auth.uid());

create policy "office reads own tenant profiles" on public.profiles
  for select using (
    public.is_office_or_above()
    and (tenant_id = public.current_tenant_id() or public.current_role() = 'super_admin')
  );

create policy "super_admin manages all profiles" on public.profiles
  for all using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');

-- office can edit display name / active flag for their own tenant's staff,
-- but NOT escalate role (role changes are super_admin only via the policy above).
create policy "office updates own tenant staff (not role)" on public.profiles
  for update using (
    public.current_role() = 'office'
    and tenant_id = public.current_tenant_id()
  )
  with check (
    tenant_id = public.current_tenant_id()
    and role = 'staff'   -- office may only touch rows that remain 'staff'
  );

-- ---------- products / skus ----------
-- readable: your tenant's own products, OR the shared master catalog (tenant_id is null)
create policy "read tenant or master products" on public.products
  for select using (
    tenant_id is null
    or tenant_id = public.current_tenant_id()
    or public.current_role() = 'super_admin'
  );

create policy "office manages own tenant products" on public.products
  for all using (
    public.current_role() = 'office' and tenant_id = public.current_tenant_id()
  )
  with check (
    public.current_role() = 'office' and tenant_id = public.current_tenant_id()
  );

create policy "super_admin manages master + all products" on public.products
  for all using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');

create policy "read skus of visible products" on public.skus
  for select using (
    exists (
      select 1 from public.products p
      where p.id = skus.product_id
        and (p.tenant_id is null or p.tenant_id = public.current_tenant_id()
             or public.current_role() = 'super_admin')
    )
  );

create policy "office manages skus of own tenant products" on public.skus
  for all using (
    exists (
      select 1 from public.products p
      where p.id = skus.product_id
        and p.tenant_id = public.current_tenant_id()
        and public.current_role() = 'office'
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = skus.product_id
        and p.tenant_id = public.current_tenant_id()
        and public.current_role() = 'office'
    )
  );

create policy "super_admin manages all skus" on public.skus
  for all using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');

-- ---------- stock_take_sessions ----------
create policy "tenant reads own sessions" on public.stock_take_sessions
  for select using (
    tenant_id = public.current_tenant_id() or public.current_role() = 'super_admin'
  );

create policy "office starts/closes sessions" on public.stock_take_sessions
  for all using (
    tenant_id = public.current_tenant_id() and public.is_office_or_above()
  )
  with check (
    tenant_id = public.current_tenant_id() and public.is_office_or_above()
  );

-- ---------- stock_counts ----------
-- Staff AND office both need full read/write on their tenant's counts —
-- this is a collaborative counting workflow (one staffer does Front, another
-- does Back of House on the same SKU). The office-only boundary is the
-- *bulk export*, which is enforced in the API route below, not by hiding
-- individual rows here.
create policy "tenant reads own stock counts" on public.stock_counts
  for select using (
    tenant_id = public.current_tenant_id() or public.current_role() = 'super_admin'
  );

create policy "tenant writes own stock counts" on public.stock_counts
  for insert with check (tenant_id = public.current_tenant_id());

create policy "tenant updates own stock counts" on public.stock_counts
  for update using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- ---------- exchange_logs ----------
-- Per the brief: staff may stage/save exchange entries but may NOT browse
-- the historical log. So staff can INSERT and can SELECT only their own
-- rows (to confirm what they just entered); office/super_admin can SELECT
-- every row for their tenant.
create policy "staff inserts own-tenant exchange logs" on public.exchange_logs
  for insert with check (
    tenant_id = public.current_tenant_id()
    and operator_id = auth.uid()
  );

create policy "staff reads own submitted logs" on public.exchange_logs
  for select using (
    tenant_id = public.current_tenant_id()
    and operator_id = auth.uid()
  );

create policy "office reads full tenant log history" on public.exchange_logs
  for select using (
    tenant_id = public.current_tenant_id() and public.is_office_or_above()
  );

create policy "office manages tenant exchange logs" on public.exchange_logs
  for update using (
    tenant_id = public.current_tenant_id() and public.is_office_or_above()
  )
  with check (
    tenant_id = public.current_tenant_id() and public.is_office_or_above()
  );

-- =========================================================================
-- Convenience view for exports (office/super_admin only via RLS below)
-- =========================================================================
create view public.stock_take_export_v as
  select
    sc.session_id,
    t.company_name,
    p.category,
    p.name           as style_name,
    s.colorway,
    s.size,
    s.sku_code,
    sc.front_count,
    sc.boh_count,
    coalesce(sc.front_count, 0) + coalesce(sc.boh_count, 0) as total_in_store,
    sc.notes,
    sc.updated_at,
    pr.full_name      as counted_by
  from public.stock_counts sc
  join public.skus s      on s.id = sc.sku_id
  join public.products p  on p.id = s.product_id
  join public.tenants t   on t.id = sc.tenant_id
  left join public.profiles pr on pr.id = sc.counter_id;

alter view public.stock_take_export_v set (security_invoker = on);
-- security_invoker means the view respects the querying user's own RLS on
-- stock_counts (tenant-scoped for everyone) — the export ROUTE HANDLER is
-- what actually restricts this to office/super_admin, since "can this role
-- see the data" (yes, tenant-scoped) and "can this role bulk-download it"
-- (no, office-only) are different questions. See README.
