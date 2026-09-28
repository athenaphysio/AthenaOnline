-- The PDF download step of the Running Builder brief: "when a client moves
-- up a rung (or drops back, or starts a flare deload), show a small note
-- ... download a fresh copy." running_programme_state.updated_at already
-- changes on every rung move (progression, approval, manual override,
-- flare drop-back); this column records the last time a PDF was actually
-- generated, so the note only shows when updated_at has moved past it --
-- never shown to a client who's never touched the PDF at all.
alter table public.running_programme_state add column pdf_generated_at timestamptz;
