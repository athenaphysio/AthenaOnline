-- A circuit exercise copied from Movement.so without a dose is stored with
-- amount 0, meaning the dose is still to be confirmed. builder.circuit_library()
-- says so in words rather than showing "0 reps".

create or replace function builder.circuit_library()
returns jsonb
language sql stable
set search_path to 'public'
as $$
  select jsonb_build_object(
    'blocks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', b.name,
        'notes', b.notes,
        'exercises', coalesce((
          select jsonb_agg(jsonb_build_object(
            'exercise', coalesce(e.name_clinical, x->>'name'),
            'dose', case when coalesce((x->>'amount')::int, 0) = 0 then 'dose to be confirmed by Dr David Silver PhD'
              else (x->>'amount') || ' ' ||
                case x->>'dose_type' when 'time' then 'seconds' when 'contacts' then 'contacts' else 'reps' end ||
                case when (x->>'per_side')::boolean then ' each side' else '' end end,
            'note', nullif(x->>'note', '')) order by ord)
          from jsonb_array_elements(b.exercises) with ordinality as t(x, ord)
          left join exercises e on e.exercise_id = x->>'exercise_id'), '[]'::jsonb),
        'in_phase_sets', coalesce((
          select jsonb_agg(s.name order by s.sort_order, s.name)
          from run_circuit_sets s where b.id = any(s.block_ids)), '[]'::jsonb))
        order by b.sort_order, b.name)
      from run_circuit_blocks b), '[]'::jsonb),
    'phase_sets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', s.name,
        'notes', s.notes,
        'blocks', coalesce((
          select jsonb_agg(b.name order by ord)
          from unnest(s.block_ids) with ordinality as u(bid, ord)
          join run_circuit_blocks b on b.id = u.bid), '[]'::jsonb))
        order by s.sort_order, s.name)
      from run_circuit_sets s), '[]'::jsonb)
  );
$$;

revoke all on all functions in schema builder from public, anon, authenticated;
