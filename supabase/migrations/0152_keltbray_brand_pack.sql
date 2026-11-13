-- Keltbray brand pack, for Regenerate's work with Keltbray.
--
-- Every colour is Keltbray's own, as published in its website's brand
-- colours: Keltbray green #00AA4F as the primary accent, charcoal #000D20 as
-- the background, with Keltbray blue, sky, red, golden yellow, night sky,
-- stone and steel for lines, charts and text. Typefaces follow its website:
-- Volkhov for headings and Montserrat for body text. The logo images in
-- public/brand-packs/keltbray are drawn from Keltbray's own logo artwork.
--
-- The pack is not the default and is assigned to nobody, so it changes
-- nothing until it is assigned to a programme or client in the clinic, or a
-- client signs up through /join/keltbray.
--
-- The app layout starts from Regenerate's own pack, so the ROAM app, the
-- Regenerate team and the tabs carry across, with Keltbray's look on top.

alter table public.brand_packs drop constraint if exists brand_packs_heading_font_check;
alter table public.brand_packs
  add constraint brand_packs_heading_font_check check (heading_font is null or heading_font in ('lexend', 'archivo', 'barlow', 'dmsans', 'volkhov'));

insert into public.brand_packs (
  name, is_default, accent_color, background_color, theme, heading_font,
  logo_mark_url, wordmark_url, wordmark_reversed_url, cover_square_url, wide_banner_url, small_square_url, background_texture_url,
  app_layout
)
select
  'Keltbray', false, '#00AA4F', '#000D20', 'dark', 'volkhov',
  'https://app.drdavidsilverphd.com/brand-packs/keltbray/logo-mark.png',
  'https://app.drdavidsilverphd.com/brand-packs/keltbray/wordmark.png',
  'https://app.drdavidsilverphd.com/brand-packs/keltbray/wordmark-reversed.png',
  'https://app.drdavidsilverphd.com/brand-packs/keltbray/cover-square.jpg',
  'https://app.drdavidsilverphd.com/brand-packs/keltbray/wide-banner.jpg',
  'https://app.drdavidsilverphd.com/brand-packs/keltbray/small-square.png',
  'https://app.drdavidsilverphd.com/brand-packs/keltbray/background-texture.png',
  coalesce((select r.app_layout from public.brand_packs r where r.name = 'Regenerate Wellness' limit 1), '{}'::jsonb)
  || jsonb_build_object(
    'link_name', 'keltbray',
    'app_name', 'ROAM',
    'app_strapline', 'Workforce wellbeing for Keltbray, delivered by Regenerate',
    'app_logo', '/brand-packs/regenerate/roam-logo.png',
    'app_logo_on_dark', '/brand-packs/regenerate/roam-logo.png',
    'app_icon', '/brand-packs/keltbray/app-icon.png',
    'greeting_image', '/brand-packs/keltbray/greeting-mark.png',
    'palette', jsonb_build_object(
      'base', '#000d20', 'surface', '#0a1a30', 'recessed', '#000814', 'line', '#0067b1',
      'text', '#ffffff', 'textSoft', '#c6cacb', 'textMuted', '#8fa2a8',
      'accent', '#00aa4f', 'sky', '#66cef6', 'blue', '#0067b1', 'pink', '#ffc226',
      'green', '#7cc89c', 'coral', '#ee3124', 'violet', '#002e65', 'body', 'montserrat'
    )
  )
where not exists (select 1 from public.brand_packs where name = 'Keltbray');
