-- Four more parts of a client's record can be shared with a clinician,
-- each with its own tick box on the Staff page: the sessions and practice
-- log, forms and answers, messages (read only) and documents.
alter table public.staff_package_sections drop constraint if exists staff_package_sections_section_check;
alter table public.staff_package_sections
  add constraint staff_package_sections_section_check check (section in (
    'details', 'context', 'programme',
    'heart_recovery', 'sleep_energy', 'blood', 'gut', 'body_movement', 'mind_behaviour',
    'physical', 'sessions', 'forms', 'messages', 'documents', 'write_notes'
  ));
