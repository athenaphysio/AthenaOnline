type Prescription = {
  sets: number | null;
  reps: number | null;
  hold_seconds: number | null;
  percent_max: number | null;
  frequency: string | null;
};

export function prescriptionChips(item: Prescription): string[] {
  const chips: string[] = [];
  if (item.sets) chips.push(`${item.sets} sets`);
  if (item.reps) chips.push(`${item.reps} reps`);
  else if (item.hold_seconds) chips.push(`${item.hold_seconds} sec hold`);
  if (item.percent_max) chips.push(`${item.percent_max}% max`);
  if (item.frequency) chips.push(item.frequency);
  return chips;
}

export function prescriptionSummary(item: Prescription): string {
  const parts: string[] = [];
  if (item.sets) parts.push(`${item.sets} sets`);
  if (item.reps) parts.push(`${item.reps} reps`);
  else if (item.hold_seconds) parts.push(`${item.hold_seconds} sec hold`);
  return parts.join(" · ");
}
