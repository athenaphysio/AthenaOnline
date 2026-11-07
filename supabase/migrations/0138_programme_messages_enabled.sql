-- Whether a client sees the "Something not feeling right? Message David"
-- line under their programme. Off by default; Dr David Silver PhD switches
-- it on per client from their dashboard, or for everyone on a brand pack
-- from the pack's app settings (app_layout.programme_messages).

alter table public.patients add column if not exists programme_messages_enabled boolean not null default false;
