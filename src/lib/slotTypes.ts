export type SlotType = "warm_up" | "activation" | "main_body" | "injury_prevention" | "cool_down";

export const SLOT_TYPES: { value: SlotType; label: string }[] = [
  { value: "warm_up", label: "Warm-up" },
  { value: "activation", label: "Activation" },
  { value: "main_body", label: "Main Body" },
  { value: "injury_prevention", label: "Injury Prevention" },
  { value: "cool_down", label: "Cool-down" },
];

export function slotTypeLabel(type: string): string {
  return SLOT_TYPES.find((t) => t.value === type)?.label ?? type;
}
