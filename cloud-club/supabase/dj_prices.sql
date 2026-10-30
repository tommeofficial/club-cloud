-- Club Cloud: DJ-set prices. Each DJ sets what their room charges for entry, song requests, shout-outs, meet and greets, and the smallest tip.
-- Prices are in pence. Run in the Supabase SQL editor (after schema.sql). Everyone can read prices; only the room's owner can change them.
-- (Entry is shown and confirmed in the app now, but only enforced once real payments are connected.)
create table if not exists dj_prices (
  room text primary key references rooms(username) on delete cascade,
  entry_pence integer not null default 0 check (entry_pence between 0 and 10000),
  song_pence integer not null default 500 check (song_pence between 0 and 50000),
  shout_pence integer not null default 500 check (shout_pence between 0 and 50000),
  meet_pence integer not null default 3000 check (meet_pence between 0 and 100000),
  tip_min_pence integer not null default 100 check (tip_min_pence between 0 and 50000),
  updated_at timestamptz not null default now()
);
alter table dj_prices enable row level security;
drop policy if exists "prices readable" on dj_prices;
create policy "prices readable" on dj_prices for select using (true);
drop policy if exists "prices write own" on dj_prices;
create policy "prices write own" on dj_prices for all
  using (room in (select username from profiles where id = auth.uid()))
  with check (room in (select username from profiles where id = auth.uid()));
