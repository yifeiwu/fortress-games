-- Move room chat and player presence (heartbeats) out of the room runtime
-- state blob and into their own room-code-keyed, independently-versioned rows.
-- This stops high-frequency chat and heartbeat writes from contending with game
-- moves on the room's optimistic version.

create table if not exists room_chat_state (
  room_code text primary key check (room_code ~ '^[A-Z]{6}$'),
  payload jsonb not null default '[]'::jsonb,
  version integer not null default 1 check (version > 0),
  deleted_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists room_presence_state (
  room_code text primary key check (room_code ~ '^[A-Z]{6}$'),
  payload jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version > 0),
  deleted_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists idx_room_chat_state_active
  on room_chat_state (updated_at desc)
  where deleted_at is null;

create index if not exists idx_room_presence_state_active
  on room_presence_state (updated_at desc)
  where deleted_at is null;

-- Backfill chat history from the existing room payloads.
insert into room_chat_state (room_code, payload)
select room_code, coalesce(payload -> 'chat', '[]'::jsonb)
from room_runtime_state
where deleted_at is null
on conflict (room_code) do nothing;

-- Backfill presence from each human player's prior lastSeenAt timestamp.
insert into room_presence_state (room_code, payload)
select
  room_code,
  coalesce((
    select jsonb_object_agg(player_elem ->> 'id', to_jsonb((player_elem ->> 'lastSeenAt')::bigint))
    from jsonb_array_elements(payload -> 'players') as player_elem
    where (player_elem ->> 'isBot')::boolean is not true
      and player_elem ? 'lastSeenAt'
  ), '{}'::jsonb)
from room_runtime_state
where deleted_at is null
  and payload ? 'players'
on conflict (room_code) do nothing;

-- Drop the now-relocated chat from the room payload (keep an empty array so the
-- shape matches newly-created rooms) and strip the per-player lastSeenAt field.
update room_runtime_state
set payload = jsonb_set(
  case
    when payload ? 'players' then jsonb_set(
      payload,
      '{players}',
      coalesce((
        select jsonb_agg(player_elem - 'lastSeenAt')
        from jsonb_array_elements(payload -> 'players') as player_elem
      ), '[]'::jsonb)
    )
    else payload
  end,
  '{chat}',
  '[]'::jsonb
)
where deleted_at is null;
