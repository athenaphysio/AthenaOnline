-- Searchable format designations on blocks and workouts, so a HIIT or
-- cardio-format block can be found as such without inventing a separate
-- content type for it. David's requirement was "as long as I can search
-- and see all the blocks and workouts that are HIIT format, all good."
--
-- Multi-valued on purpose: a 30 seconds on, 30 seconds off bike block is
-- genuinely both HIIT and Cardio, and forcing a single choice would lose
-- that. Values are validated in TypeScript (src/lib/designations.ts), the
-- same approach blocks.sequence_type already uses, so adding a new
-- designation later is a code change rather than another migration.
--
-- cardio_blocks deliberately does NOT get this column: everything a
-- designation would say about one is already in its own structure/format
-- fields, so it is derived instead (designationsForCardioBlock) and there
-- is no second copy of the same fact to keep in step.

alter table blocks
  add column if not exists designations text[] not null default '{}';

alter table workouts
  add column if not exists designations text[] not null default '{}';

-- GIN indexes so "show me everything marked HIIT" stays an index lookup
-- rather than a scan as the libraries grow.
create index if not exists blocks_designations_idx
  on blocks using gin (designations);

create index if not exists workouts_designations_idx
  on workouts using gin (designations);
