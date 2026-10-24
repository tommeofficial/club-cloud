-- Email sign-ups from the website. Run once in the Supabase SQL editor.
-- Anyone can add their email; nobody can read the list from the browser. View it in Table Editor > signups.
create table if not exists signups (
  id bigserial primary key,
  email text not null unique check (char_length(email) <= 254 and email ~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'),
  source text not null default 'website' check (char_length(source) <= 30),
  created_at timestamptz not null default now()
);

alter table signups enable row level security;

create policy "anyone can sign up" on signups for insert to anon, authenticated with check (true);

grant insert on signups to anon, authenticated;
grant usage, select on sequence signups_id_seq to anon, authenticated;
