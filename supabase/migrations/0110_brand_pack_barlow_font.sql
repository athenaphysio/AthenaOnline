-- Adds Barlow Condensed as a heading typeface a brand pack can choose,
-- the closest free match to the DIN Condensed in Regenerate's materials.
alter table public.brand_packs drop constraint if exists brand_packs_heading_font_check;
alter table public.brand_packs
  add constraint brand_packs_heading_font_check check (heading_font is null or heading_font in ('lexend', 'archivo', 'barlow'));
