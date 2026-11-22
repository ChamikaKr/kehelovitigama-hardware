create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  telephone text,
  address text,
  sales_rep_name text,
  sales_rep_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists suppliers_name_normalized_uidx
  on public.suppliers (lower(btrim(name)));

alter table public.suppliers enable row level security;
grant select, insert, update on public.suppliers to authenticated;

drop policy if exists "Authenticated users can view suppliers" on public.suppliers;
drop policy if exists "Authenticated users can add suppliers" on public.suppliers;
drop policy if exists "Authenticated users can edit suppliers" on public.suppliers;
create policy "Authenticated users can view suppliers"
  on public.suppliers for select to authenticated using (true);
create policy "Authenticated users can add suppliers"
  on public.suppliers for insert to authenticated with check (true);
create policy "Authenticated users can edit suppliers"
  on public.suppliers for update to authenticated using (true) with check (true);

insert into public.suppliers (name)
select distinct on (lower(btrim(supplier_name))) btrim(supplier_name)
from public.purchases
where nullif(btrim(supplier_name), '') is not null
order by lower(btrim(supplier_name)), created_at desc
on conflict do nothing;