-- Nscale brand pack, for Regenerate's workforce programme with Nscale.
--
-- Colours and typeface are Nscale's own, from its public media kit:
-- Nscale blue #0F41F3, Midnight #040E27 and Chalk #FDFFF8, with DM Sans for
-- headlines and body text. The logo images in public/brand-packs/nscale are
-- drawn from Nscale's own logo artwork, in the all white form its media kit
-- names as the primary colourway. The highlight colours used for charts and
-- results (sky, pink, green, coral, violet) are not in Nscale's palette; they
-- are chosen to sit with it and can be changed on the pack's page.
--
-- The pack is not the default and is assigned to nobody, so it changes
-- nothing until it is assigned to a programme or client in the clinic, or a
-- client signs up through /join/nscale.
--
-- The app layout starts from Regenerate's own pack, so the ROAM app, the
-- Regenerate team and the tabs carry across, with Nscale's look on top.

alter table public.brand_packs drop constraint if exists brand_packs_heading_font_check;
alter table public.brand_packs
  add constraint brand_packs_heading_font_check check (heading_font is null or heading_font in ('lexend', 'archivo', 'barlow', 'dmsans'));

insert into public.brand_packs (
  name, is_default, accent_color, background_color, theme, heading_font,
  logo_mark_url, wordmark_url, wordmark_reversed_url, cover_square_url, wide_banner_url, small_square_url, background_texture_url,
  app_layout
)
select
  'Nscale', false, '#0F41F3', '#040E27', 'dark', 'dmsans',
  'https://app.drdavidsilverphd.com/brand-packs/nscale/logo-mark.png',
  'https://app.drdavidsilverphd.com/brand-packs/nscale/wordmark.png',
  'https://app.drdavidsilverphd.com/brand-packs/nscale/wordmark-reversed.png',
  'https://app.drdavidsilverphd.com/brand-packs/nscale/cover-square.jpg',
  'https://app.drdavidsilverphd.com/brand-packs/nscale/wide-banner.jpg',
  'https://app.drdavidsilverphd.com/brand-packs/nscale/small-square.png',
  'https://app.drdavidsilverphd.com/brand-packs/nscale/background-texture.png',
  coalesce((select r.app_layout from public.brand_packs r where r.name = 'Regenerate Wellness' limit 1), '{}'::jsonb)
  || jsonb_build_object(
    'link_name', 'nscale',
    'app_name', 'ROAM',
    'app_strapline', 'Workforce wellbeing for Nscale, delivered by Regenerate',
    'app_logo', '/brand-packs/regenerate/roam-logo.png',
    'app_logo_on_dark', '/brand-packs/regenerate/roam-logo.png',
    'app_icon', '/brand-packs/nscale/app-icon.png',
    'greeting_image', '/brand-packs/nscale/greeting-mark.png',
    'palette', jsonb_build_object(
      'base', '#040e27', 'surface', '#0a1a3f', 'recessed', '#020a1c', 'line', '#0f41f3',
      'text', '#fdfff8', 'textSoft', '#c8d1e8', 'textMuted', '#8e9cc4',
      'accent', '#0f41f3', 'sky', '#6f9bff', 'blue', '#0f41f3', 'pink', '#b9a8ff',
      'green', '#74d3a6', 'coral', '#ff7a6b', 'violet', '#3b2fa8', 'body', 'dmsans'
    )
  )
where not exists (select 1 from public.brand_packs where name = 'Nscale');
