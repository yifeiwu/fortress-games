-- The original monolithic `runtime_state` table was superseded by the versioned
-- per-entity tables (room_runtime_state, player_session_state, room_chat_state,
-- room_presence_state). Its only remaining use was the one-time backfill in
-- 20260604120000_versioned_runtime_state.sql, so it is now dead and can be
-- dropped to reclaim space and remove the unused schema.
drop table if exists runtime_state;
