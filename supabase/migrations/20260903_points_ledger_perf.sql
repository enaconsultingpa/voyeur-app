-- Performance follow-up for points_ledger (from Supabase advisor checks)

create index if not exists points_ledger_member_id_idx on points_ledger(member_id);
create index if not exists points_ledger_club_id_idx on points_ledger(club_id);
create index if not exists points_ledger_created_by_idx on points_ledger(created_by);

-- Wrap auth.uid() in a subselect so it's evaluated once per query, not once per row
drop policy if exists "members read own points" on points_ledger;
create policy "members read own points"
  on points_ledger for select
  using (member_id = (select auth.uid()));

drop policy if exists "staff manage points" on points_ledger;
create policy "staff manage points"
  on points_ledger for all
  using (exists (select 1 from staff where staff.id = (select auth.uid())))
  with check (exists (select 1 from staff where staff.id = (select auth.uid())));
