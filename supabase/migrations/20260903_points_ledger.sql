-- Rewards / points program v1
-- A member's balance is the sum of their ledger rows (kind='earn' minus kind='redeem') — never stored separately.

create table if not exists points_ledger (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  club_id uuid references clubs(id),
  kind text not null check (kind in ('earn', 'redeem')),
  points integer not null check (points > 0),
  dollar_amount numeric(10,2), -- set for 'earn' rows, null for 'redeem'
  note text, -- optional, e.g. "free drink", "half off cover"
  created_by uuid references staff(id), -- which staff member logged it
  created_at timestamptz not null default now()
);

alter table points_ledger enable row level security;

-- Members can read their own ledger rows
create policy "members read own points"
  on points_ledger for select
  using (member_id = auth.uid());

-- Staff can do everything (mirrors the existing staff-manage pattern used elsewhere)
create policy "staff manage points"
  on points_ledger for all
  using (exists (select 1 from staff where staff.id = auth.uid()))
  with check (exists (select 1 from staff where staff.id = auth.uid()));
