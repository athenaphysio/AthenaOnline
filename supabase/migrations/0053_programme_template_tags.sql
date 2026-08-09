-- Vault's programme template library needs something to tag/filter by
-- (e.g. "Return to running", "Post-op ACL") -- no such field exists on
-- programme_templates today. A simple text array, David's own free-form
-- tags rather than a fixed taxonomy, since goal/body-part tagging for a
-- whole programme is inherently more varied than the exercise body-part
-- list (0050_exercise_body_parts.sql).
alter table public.programme_templates add column tags text[] not null default '{}';
