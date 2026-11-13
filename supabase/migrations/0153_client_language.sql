-- The language each client sees their app in, chosen by the client on the
-- Me tab. English is the default and the master copy; every other language
-- falls back to English for any words not yet translated.
--
-- Codes: en English, pl Polish, es Spanish, nb Norwegian (bokmål),
-- sv Swedish, da Danish, pt Portuguese. Adding a language later means a new
-- migration that widens this list (see src/i18n/languages.ts).

alter table public.patients
  add column if not exists language text not null default 'en';

alter table public.patients
  drop constraint if exists patients_language_check;

alter table public.patients
  add constraint patients_language_check
  check (language in ('en', 'pl', 'es', 'nb', 'sv', 'da', 'pt'));
