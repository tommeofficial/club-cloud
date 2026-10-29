-- Club Cloud: deck time. Watching streams is free; USING THE DECKS is metered.
--   * 5 free minutes per account per rolling 24 hours (the first use starts the clock; 24 hours later it resets).
--   * After that, paid time: GBP 1 buys 1 hour, any number of hours, and it never expires. It only counts down while a deck is playing.
-- Run this in the Supabase SQL editor. Wallets can only be changed through the functions below, never directly.
--
-- NOTE: test_buy_hours() adds time for free so the whole flow can be tried before real payments exist.
--       DROP IT before taking real money (see the bottom of this file) and add time from the payment webhook with grant_paid_seconds().

create table if not exists wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  free_window_start timestamptz,                         -- when the current 24-hour free allowance began (null = unused)
  free_used_seconds integer not null default 0 check (free_used_seconds >= 0),
  paid_seconds integer not null default 0 check (paid_seconds >= 0)
);
alter table wallets enable row level security;
drop policy if exists "wallet readable by owner" on wallets;
create policy "wallet readable by owner" on wallets for select using (user_id = auth.uid());
-- no insert / update / delete policies: only the security-definer functions below can change a wallet

create or replace function wallet_status() returns json
language plpgsql security definer set search_path = public as $$
declare w wallets; free_total constant int := 300;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  insert into wallets (user_id) values (auth.uid()) on conflict do nothing;
  select * into w from wallets where user_id = auth.uid();
  if w.free_window_start is not null and now() - w.free_window_start >= interval '24 hours' then
    update wallets set free_window_start = null, free_used_seconds = 0 where user_id = auth.uid();
    w.free_window_start := null; w.free_used_seconds := 0;
  end if;
  return json_build_object(
    'free_left', greatest(0, free_total - w.free_used_seconds),
    'paid_left', w.paid_seconds,
    'free_resets_at', case when w.free_window_start is null then null else w.free_window_start + interval '24 hours' end);
end $$;

-- the app reports deck-playing time in small chunks; free time is used first, then paid time
create or replace function use_deck_time(p_seconds integer) returns json
language plpgsql security definer set search_path = public as $$
declare w wallets; free_total constant int := 300; s int; from_free int; from_paid int;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  s := greatest(0, least(coalesce(p_seconds, 0), 120));  -- never more than two minutes in one report
  insert into wallets (user_id) values (auth.uid()) on conflict do nothing;
  select * into w from wallets where user_id = auth.uid() for update;
  if w.free_window_start is not null and now() - w.free_window_start >= interval '24 hours' then
    w.free_window_start := null; w.free_used_seconds := 0;
  end if;
  if s > 0 and w.free_window_start is null then w.free_window_start := now(); end if;
  from_free := least(s, free_total - w.free_used_seconds);
  from_paid := least(s - from_free, w.paid_seconds);
  update wallets set free_window_start = w.free_window_start,
                     free_used_seconds = w.free_used_seconds + from_free,
                     paid_seconds = w.paid_seconds - from_paid
   where user_id = auth.uid();
  return wallet_status();
end $$;

-- TEST ONLY: buy hours for free
create or replace function test_buy_hours(p_hours integer) returns json
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  insert into wallets (user_id) values (auth.uid()) on conflict do nothing;
  update wallets set paid_seconds = paid_seconds + 3600 * greatest(1, least(coalesce(p_hours, 1), 10)) where user_id = auth.uid();
  return wallet_status();
end $$;

-- for the payment webhook (service role only): add paid time after a successful payment
create or replace function grant_paid_seconds(p_user uuid, p_seconds integer) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into wallets (user_id) values (p_user) on conflict do nothing;
  update wallets set paid_seconds = paid_seconds + greatest(0, p_seconds) where user_id = p_user;
end $$;

revoke all on function grant_paid_seconds(uuid, integer) from public, anon, authenticated;
grant execute on function wallet_status() to authenticated;
grant execute on function use_deck_time(integer) to authenticated;
grant execute on function test_buy_hours(integer) to authenticated;

-- BEFORE TAKING REAL MONEY:
--   drop function test_buy_hours(integer);
