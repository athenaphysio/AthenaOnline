-- Atomic Rowing: a brand pack presented by Athena Online, built from the
-- Atomic Rowing logo. Dark night-water look in the logo's own colours
-- (crimson #cb2852, purple #9a33cc, deep purple #330066), Archivo Black
-- headings to match the logo's heavy lettering, a seamless water and oars
-- texture along the bottom of the screen, and its own home screen icon.
-- Images live in public/brand-packs/atomic-rowing, made by
-- scripts/brand-packs/atomic-rowing/gen.js. Join link: /join/rowing.
insert into public.brand_packs (
  name, is_default, accent_color, background_color, theme, heading_font,
  logo_mark_url, wordmark_url, wordmark_reversed_url, cover_square_url, wide_banner_url, small_square_url, background_texture_url,
  app_layout
)
select
  'Atomic Rowing', false, '#cb2852', '#14082a', 'dark', 'archivo',
  'https://app.drdavidsilverphd.com/brand-packs/atomic-rowing/logo-mark.png',
  'https://app.drdavidsilverphd.com/brand-packs/atomic-rowing/wordmark.png',
  'https://app.drdavidsilverphd.com/brand-packs/atomic-rowing/wordmark-reversed.png',
  'https://app.drdavidsilverphd.com/brand-packs/atomic-rowing/cover-square.jpg',
  'https://app.drdavidsilverphd.com/brand-packs/atomic-rowing/wide-banner.jpg',
  'https://app.drdavidsilverphd.com/brand-packs/atomic-rowing/small-square.jpg',
  'https://app.drdavidsilverphd.com/brand-packs/atomic-rowing/background-texture.png',
  jsonb_build_object(
    'app_name', 'Atomic Rowing',
    'app_strapline', 'Presented by Athena Online',
    'app_logo', '/brand-packs/atomic-rowing/wordmark-reversed.png',
    'app_logo_on_dark', '/brand-packs/atomic-rowing/wordmark-reversed.png',
    'app_icon', '/brand-packs/atomic-rowing/app-icon.png',
    'link_name', 'rowing',
    'signoff', 'david',
    'team_name', 'Athena Physio',
    'team', jsonb_build_array(jsonb_build_object('name', 'Dr David Silver PhD', 'role', 'Chartered Physiotherapist', 'about', '', 'photo', '/patient/david-signature-photo.jpg')),
    'palette', jsonb_build_object(
      'base', '#14082a', 'surface', '#200f3e', 'recessed', '#0e051f', 'line', '#5b2a8f',
      'text', '#f3eef8', 'textSoft', '#d4c6e6', 'textMuted', '#a08cbf',
      'accent', '#cb2852', 'sky', '#7fb7e6', 'blue', '#6a5be0', 'pink', '#e58fb1',
      'green', '#9cc58a', 'coral', '#ef7a7a', 'violet', '#9a33cc', 'body', ''
    )
  )
where not exists (select 1 from public.brand_packs where name = 'Atomic Rowing');

-- The Athena wordmark sits in the top bar, as on the other Athena packs,
-- with the Atomic Rowing logo underneath it (app_logo).
update public.brand_packs
set wordmark_url = 'https://app.drdavidsilverphd.com/brand-packs/atomic-rowing/athena-wordmark.png',
    wordmark_reversed_url = 'https://app.drdavidsilverphd.com/brand-packs/atomic-rowing/athena-wordmark-reversed.png'
where name = 'Atomic Rowing';

-- Faint water ripples tiled across the whole page behind the cards
-- (app_layout.canvas_pattern), above the gradient and below the bottom strip.
update public.brand_packs
set app_layout = app_layout || jsonb_build_object('canvas_pattern', '/brand-packs/atomic-rowing/canvas-ripples.png')
where name = 'Atomic Rowing';

-- Original stylised rowers repeated faintly down both edges of the page,
-- scrolling with it (app_layout.side_pattern_left / side_pattern_right).
update public.brand_packs
set app_layout = app_layout || jsonb_build_object(
  'side_pattern_left', '/brand-packs/atomic-rowing/side-rowers-left.png',
  'side_pattern_right', '/brand-packs/atomic-rowing/side-rowers-right.png'
)
where name = 'Atomic Rowing';
