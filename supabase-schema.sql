-- ================================================
-- NEBUMIA — SUPABASE SCHEMA
-- Ejecutar en: Supabase → SQL Editor → New query
-- ================================================

create table public.clients (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text default '', ruc text default '', date text default '',
  contact text default '', email text default '', phone text default '',
  client_type text default '', country text default 'Perú',
  owner text default '', source text default '', notes text default '',
  created_at timestamptz default now()
);

create table public.leads (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text default '', client text default '', service text default '',
  source text default '', channel text default '', owner text default '',
  status text default 'Nuevo', estimated_value decimal default 0,
  date text default '', notes text default '', quote_id text default '',
  created_at timestamptz default now()
);

create table public.quotes (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  code text default '', client text default '', service text default '',
  category text default '', owner text default '', subtotal decimal default 0,
  has_igv boolean default true, status text default 'Por cotizar',
  payment_type text default 'split', currency text default 'PEN',
  date text default '', won_date text default '', repo text default '',
  comments text default '', cuotas int default 1,
  invoice text default '', bank_account text default '',
  created_at timestamptz default now()
);

create table public.collections (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  quote_id text default '', part int default 1, label text default '',
  due_date text default '', amount decimal default 0, detraction decimal default 0,
  currency text default 'PEN', status text default 'Pendiente',
  paid_date text default '', invoice text default '',
  bank_account text default '', declared text default 'Sin declarar',
  created_at timestamptz default now()
);

create table public.expenses (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  date text default '', concept text default '', type text default 'Gasto fijo',
  amount decimal default 0, currency text default 'PEN',
  vendor text default '', ruc text default '', invoice text default '',
  category text default '', doc_link text default '',
  created_at timestamptz default now()
);

create table public.team_payments (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  month text default '', name text default '', role text default '',
  amount decimal default 0, status text default 'Pendiente',
  receipt text default '', due_date text default '', ruc text default '',
  currency text default 'PEN', bank_name text default '',
  account_number text default '', cci text default '',
  comm_invoice text default '', comm_repo text default '',
  created_at timestamptz default now()
);

create table public.tax_payments (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  date text default '', type text default '', period text default '',
  amount decimal default 0, status text default 'Pendiente',
  sunat_ref text default '', doc_link text default '',
  created_at timestamptz default now()
);

create table public.purchases (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  date text default '', vendor text default '', ruc text default '',
  invoice_type text default 'Factura', invoice_num text default '',
  concept text default '', subtotal decimal default 0,
  igv decimal default 0, total decimal default 0,
  currency text default 'PEN', detraction decimal default 0,
  paid_date text default '', bank_account text default '',
  declared text default 'Sin declarar', repo text default '',
  created_at timestamptz default now()
);

create table public.invoiced_sales (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  date text default '', client text default '', ruc text default '',
  invoice_type text default 'Factura', invoice_num text default '',
  service text default '', subtotal decimal default 0,
  igv decimal default 0, total decimal default 0,
  currency text default 'PEN', quote_id text default '', part int default 0,
  created_at timestamptz default now()
);

create table public.cash_entries (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  date text default '', type text default 'egreso', concept text default '',
  category text default '', amount decimal default 0, currency text default 'PEN',
  status text default 'Confirmado', bank_account text default '',
  notes text default '', invoice text default '',
  created_at timestamptz default now()
);

create table public.declaraciones (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  period text default '', igv1011 decimal default 0,
  renta3121 decimal default 0, otro decimal default 0,
  otro_concepto text default '', status text default 'Pendiente',
  notes text default '',
  created_at timestamptz default now()
);

create table public.settings (
  user_id uuid references auth.users(id) on delete cascade primary key,
  igv_rate decimal default 0.18,
  detraction_rate decimal default 0.12,
  detraction_threshold decimal default 700,
  commission_rate decimal default 0.05,
  currency text default 'PEN',
  bank_accounts jsonb default '[]',
  fixed_expenses jsonb default '[]',
  team_members jsonb default '[]',
  services jsonb default '[]',
  categories jsonb default '[]',
  sources jsonb default '[]',
  profiles jsonb default '[]',
  updated_at timestamptz default now()
);

create table public.sales_targets (
  user_id uuid references auth.users(id) on delete cascade not null,
  year int not null,
  mode text default 'annual',
  annual_pen decimal default 0,
  annual_usd decimal default 0,
  monthly jsonb default '{}',
  primary key (user_id, year)
);

-- ROW LEVEL SECURITY
alter table public.clients enable row level security;
alter table public.leads enable row level security;
alter table public.quotes enable row level security;
alter table public.collections enable row level security;
alter table public.expenses enable row level security;
alter table public.team_payments enable row level security;
alter table public.tax_payments enable row level security;
alter table public.purchases enable row level security;
alter table public.invoiced_sales enable row level security;
alter table public.cash_entries enable row level security;
alter table public.declaraciones enable row level security;
alter table public.settings enable row level security;
alter table public.sales_targets enable row level security;

create policy "own" on public.clients for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "own" on public.leads for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "own" on public.quotes for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "own" on public.collections for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "own" on public.expenses for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "own" on public.team_payments for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "own" on public.tax_payments for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "own" on public.purchases for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "own" on public.invoiced_sales for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "own" on public.cash_entries for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "own" on public.declaraciones for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "own" on public.settings for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "own" on public.sales_targets for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
