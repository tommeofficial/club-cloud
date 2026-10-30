-- Club Cloud: Stripe webhook support. Run in the Supabase SQL editor (after billing.sql).
-- Stripe can send the same event more than once, so paid hours are granted through grant_paid_once(), which remembers event ids.
create table if not exists stripe_events (
  id text primary key,
  received_at timestamptz not null default now()
);
alter table stripe_events enable row level security;   -- no policies: only the webhook (service role) touches it

create or replace function grant_paid_once(p_event text, p_user uuid, p_seconds integer) returns boolean
language plpgsql security definer set search_path = public as $$
declare fresh boolean;
begin
  insert into stripe_events (id) values (p_event) on conflict do nothing;
  get diagnostics fresh = row_count;
  if not fresh then return false; end if;
  insert into wallets (user_id) values (p_user) on conflict do nothing;
  update wallets set paid_seconds = paid_seconds + greatest(0, p_seconds) where user_id = p_user;
  return true;
end $$;
revoke all on function grant_paid_once(text, uuid, integer) from public, anon, authenticated;
