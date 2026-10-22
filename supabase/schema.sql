-- Cloud Club backend: profiles, room state and chat.
-- Run in the Supabase SQL editor. Writes need a signed-in user (Supabase Auth);
-- enable anonymous sign-ins in Auth settings, or use email sign-in.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (char_length(username) between 3 and 30 and username ~ '^[a-z0-9_]+$'),
  display_name text check (char_length(display_name) <= 60),
  created_at timestamptz not null default now()
);

create table if not exists rooms (
  username text primary key references profiles(username) on delete cascade,
  state text not null default 'OFFLINE' check (state in ('OFFLINE', 'LIVE-PUBLIC', 'LIVE-PRIVATE')),
  hype integer not null default 0 check (hype between 0 and 100),
  mood text check (char_length(mood) <= 60),
  updated_at timestamptz not null default now()
);

create table if not exists messages (
  id bigserial primary key,
  room text not null references rooms(username) on delete cascade,
  author text not null check (char_length(author) between 1 and 30),
  body text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);

create index if not exists messages_room_time on messages (room, created_at desc);

alter table profiles enable row level security;
alter table rooms enable row level security;
alter table messages enable row level security;

-- Anyone can read profiles, rooms and chat. Only the owner can change their own rows.
create policy "profiles readable" on profiles for select using (true);
create policy "profiles insert own" on profiles for insert with check (id = auth.uid());
create policy "profiles update own" on profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "rooms readable" on rooms for select using (true);
create policy "rooms write own" on rooms for all
  using (username in (select username from profiles where id = auth.uid()))
  with check (username in (select username from profiles where id = auth.uid()));

create policy "messages readable" on messages for select using (true);
create policy "messages insert as own profile" on messages for insert
  with check (
    auth.uid() is not null
    and author in (select username from profiles where id = auth.uid())
  );

-- Live updates to the club view.
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table messages;
