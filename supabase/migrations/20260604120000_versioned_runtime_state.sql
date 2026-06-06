create table if not exists room_runtime_state (
  room_code text primary key check (room_code ~ '^[A-Z]{6}$'),
  payload jsonb not null,
  version integer not null default 1 check (version > 0),
  deleted_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists player_session_state (
  session_id text primary key,
  payload jsonb not null,
  version integer not null default 1 check (version > 0),
  deleted_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists idx_room_runtime_state_active
  on room_runtime_state (updated_at desc)
  where deleted_at is null;

create index if not exists idx_player_session_state_active
  on player_session_state (updated_at desc)
  where deleted_at is null;

insert into room_runtime_state (room_code, payload)
select room_entry.value ->> 0, room_entry.value -> 1
from runtime_state
cross join lateral jsonb_array_elements(coalesce(payload -> 'rooms', '[]'::jsonb)) as room_entry(value)
where key = 'fortress_store_v1'
  and room_entry.value ->> 0 is not null
on conflict (room_code) do nothing;

insert into player_session_state (session_id, payload)
select session_entry.value ->> 0, session_entry.value -> 1
from runtime_state
cross join lateral jsonb_array_elements(coalesce(payload -> 'sessions', '[]'::jsonb)) as session_entry(value)
where key = 'fortress_store_v1'
  and session_entry.value ->> 0 is not null
on conflict (session_id) do nothing;
