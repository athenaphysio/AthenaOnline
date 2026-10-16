-- Brand packs can now ask for a dark client landing page.
--
-- theme: 'light' keeps today's cream page exactly as it is. 'dark' gives
-- the client landing page and the holding page a toned canvas built from
-- the pack's accent colour, cream text where it sits directly on that
-- canvas, and the pack's background texture as a fixed ridge along the
-- bottom of the screen. The boxes stay light either way.
--
-- wordmark_reversed_url: an optional second wordmark drawn in light
-- colours for dark backgrounds. The ordinary wordmark_url is still used
-- on emails and PDFs, which are always light, so the two are kept apart.
--
-- Both columns are additive with safe defaults, so every existing pack
-- carries on looking exactly as it does today.

alter table public.brand_packs
  add column if not exists theme text not null default 'light',
  add column if not exists wordmark_reversed_url text;

alter table public.brand_packs
  drop constraint if exists brand_packs_theme_check;

alter table public.brand_packs
  add constraint brand_packs_theme_check check (theme in ('light', 'dark'));
