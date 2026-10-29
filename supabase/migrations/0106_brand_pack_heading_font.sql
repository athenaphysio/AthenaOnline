-- A brand pack can now choose its own heading typeface. Null keeps the
-- standard Athena headings, so every existing pack looks exactly as before.
alter table public.brand_packs add column if not exists heading_font text;
alter table public.brand_packs drop constraint if exists brand_packs_heading_font_check;
alter table public.brand_packs
  add constraint brand_packs_heading_font_check check (heading_font is null or heading_font in ('lexend', 'archivo'));
