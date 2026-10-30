-- Club Cloud: one-time promo codes. A code gives 100 percent off Pro for 30 days (a free month of Pro) and works once, on one account.
-- Only SHA-256 hashes of the codes are stored here, so this file is safe to keep: the codes themselves are not recoverable from it.
-- Run in the Supabase SQL editor (after billing.sql).
create extension if not exists pgcrypto;

create table if not exists promo_codes (
  code_hash text primary key,                          -- sha256 of the code, upper-cased with dashes and spaces removed
  pro_days integer not null default 30 check (pro_days between 1 and 365),
  redeemed_by uuid references auth.users(id),
  redeemed_at timestamptz,
  note text
);
alter table promo_codes enable row level security;     -- no policies: only redeem_promo() can touch it

create or replace function redeem_promo(p_code text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare v text; h text; pc promo_codes;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  v := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  h := encode(digest(v, 'sha256'), 'hex');
  select * into pc from promo_codes where code_hash = h for update;
  if not found then raise exception 'invalid code'; end if;
  if pc.redeemed_by is not null then raise exception 'code already used'; end if;
  update promo_codes set redeemed_by = auth.uid(), redeemed_at = now() where code_hash = h;
  insert into wallets (user_id) values (auth.uid()) on conflict do nothing;
  update wallets set pro_until = greatest(coalesce(pro_until, now()), now()) + make_interval(days => pc.pro_days) where user_id = auth.uid();
  return wallet_status();
end $$;
grant execute on function redeem_promo(text) to authenticated;

insert into promo_codes (code_hash, pro_days, note) values
  ('bd49497d52b84c48a044320c594f7985ed10ad4e8387cadb0404231786b1a2ef', 30, 'launch code 1'),
  ('20912c9af04dae83edfa9fd9817f07e1d44272650b189ec48ca34bbe3505d40c', 30, 'launch code 2'),
  ('bd4dabc0097e2515d9f62218bdf6234424177519ed24fad4a90e22e13c67b1d9', 30, 'launch code 3'),
  ('bb4b67506b465935816be7de9dece89714041a3b8762cdcdb4704904e1bdb683', 30, 'launch code 4'),
  ('ea93f49647de72c7848192b809ea6fda4da18c8a9dcbaa670aa55ee3f01b1de5', 30, 'launch code 5'),
  ('4dc9fc2c6527aab2fd6014b6aa7020426a32b0519b9e31344885db5cf9a2e089', 30, 'launch code 6'),
  ('c36ed0e3696c31935bdcca4a07130cd6ecfc688b03d737e4f546d261c332985a', 30, 'launch code 7'),
  ('6ce4f0f9b3c3ed469c49508febff2624ca8e56528e24677a93ee49a527d6aa09', 30, 'launch code 8'),
  ('b4e1dc481eff865a6ef723a1bc1e1bf2e2ab03fb6105978eb5ba951be160377e', 30, 'launch code 9'),
  ('3f05fdde1d70d8997e164847a7058ffa1c338ca2d65ab2219eb786c23f2d7607', 30, 'launch code 10')
on conflict (code_hash) do nothing;
