create extension if not exists "pgcrypto";

create table if not exists game_types (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  display_name text not null,
  enabled boolean not null default true,
  rules_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  room_code char(6) not null unique check (room_code ~ '^[A-Z]{6}$'),
  game_type text not null references game_types(key),
  host_player_id uuid,
  status text not null check (status in ('lobby', 'in_game', 'ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  display_name text not null,
  is_bot boolean not null default false,
  bot_key text,
  is_host boolean not null default false,
  join_order int not null,
  connected boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null unique references rooms(id) on delete cascade,
  game_type text not null references game_types(key),
  state text not null check (state in ('waiting', 'round_open', 'round_revealed', 'finished')),
  leader_player_id uuid references players(id) on delete set null,
  round_index int not null default 0,
  max_rounds int not null default 1,
  round_deadline_at timestamptz,
  version int not null default 1,
  state_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists game_state_snapshots (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  version int not null,
  state_json jsonb not null,
  created_at timestamptz not null default now(),
  unique (game_id, version)
);

create table if not exists game_round_rng (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  round_index int not null,
  seed_hash text not null,
  seed_plain text,
  rng_algo text not null default 'mulberry32',
  revealed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (game_id, round_index)
);

create table if not exists round_choices (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  round_index int not null,
  player_id uuid not null references players(id) on delete cascade,
  direction text not null check (direction in ('up', 'down', 'left', 'right')),
  submitted_at timestamptz not null default now(),
  auto_submitted boolean not null default false,
  unique (game_id, round_index, player_id)
);

create table if not exists bot_profiles (
  id uuid primary key default gen_random_uuid(),
  game_type text not null references game_types(key),
  bot_key text not null,
  strategy_config_json jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  unique (game_type, bot_key)
);

insert into game_types (key, display_name, enabled, rules_json)
values
  ('arrow_predict', 'Arrow Prediction', true, '{"round_duration_sec": 10, "default_timeout_direction": "up"}'::jsonb)
on conflict (key) do nothing;

insert into bot_profiles (game_type, bot_key, strategy_config_json, enabled)
values
  ('arrow_predict', 'arrow_random_bot', '{"mode": "uniform_random"}'::jsonb, true)
on conflict (game_type, bot_key) do nothing;

create index if not exists idx_rooms_status on rooms(status);
create index if not exists idx_players_room on players(room_id);
create index if not exists idx_chat_messages_room on chat_messages(room_id, created_at);
create index if not exists idx_round_choices_game_round on round_choices(game_id, round_index);
