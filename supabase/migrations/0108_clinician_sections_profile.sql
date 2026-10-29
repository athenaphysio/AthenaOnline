-- Two more parts of a client's record that can be shared with a clinician,
-- matching Client profile: the client context (consultation summary and
-- background notes) and the physical capacity notes.
alter table public.staff_package_sections drop constraint if exists staff_package_sections_section_check;
alter table public.staff_package_sections
  add constraint staff_package_sections_section_check check (section in (
    'details', 'context', 'programme', 'heart_recovery', 'sleep_energy', 'blood', 'gut',
    'body_movement', 'mind_behaviour', 'physical', 'write_notes'
  ));
