-- Correction found while building Feature 2 (applying brand packs): the
-- default pack seeded in 0082 used the accent/background hex quoted in the
-- component spec document's "worked example" table (#B83A60 / #EFEAE6),
-- but the app's actual, currently-live crimson/cream values -- the ones
-- every patient sees today -- are #9b1c1c and #f2ede4 (globals.css --crimson
-- / --cream). The two are close but genuinely different colours.
--
-- This matters because the default pack is the fallback every unassigned
-- patient and programme resolves to -- if it doesn't match today's actual
-- hardcoded values exactly, turning on brand-pack lookups would silently
-- recolour every existing patient's app the moment Feature 2 ships, which
-- is exactly what "leave everything else using current hardcoded styling"
-- rules out.
update public.brand_packs
set accent_color = '#9b1c1c', background_color = '#f2ede4'
where is_default = true;
