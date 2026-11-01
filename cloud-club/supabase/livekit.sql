-- Club Cloud: the SFU (LiveKit) listener budget. Run in the Supabase SQL editor.
-- Every join token the server hands out is counted here in seconds, and refused once the month's budget is used up. Only the server (service role) can touch it.
create table if not exists lk_usage (
  month text primary key,              -- e.g. 2026-11
  seconds bigint not null default 0
);
alter table lk_usage enable row level security;   -- no policies: service role only

create or replace function lk_take(p_month text, p_seconds integer, p_budget bigint) returns boolean
language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  insert into lk_usage (month, seconds) values (p_month, 0) on conflict do nothing;
  update lk_usage set seconds = seconds + p_seconds where month = p_month and seconds + p_seconds <= p_budget;
  get diagnostics ok = row_count;
  return ok;
end $$;
revoke all on function lk_take(text, integer, bigint) from public, anon, authenticated;
