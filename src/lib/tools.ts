// The Tools tab of the client's app: a hub of resources the client can
// open at any time, outside their programme. It uses the same three
// hexagons as My Passport, one per area, and each area shows the live
// Flows from the Vault whose type belongs to it. Safe to use in the
// browser and on the server.
//
// To change the areas later (rename one, or move a Flow type into a
// different area), edit TOOL_ARMS. Nothing else needs to change.

import type { FlowCategory } from "./flows";

export const TOOL_ARMS = [
  {
    key: "breath",
    label: "Breath",
    line: "Breathwork",
    detail: "Paced breathing to settle, to focus, or to bring the body down after load.",
    categories: ["breath"] as FlowCategory[],
  },
  {
    key: "nervous",
    label: "Nervous system",
    line: "Neurodynamics",
    detail: "Gentle nerve glides that move the nervous system through easy, comfortable range.",
    categories: ["neurodynamic"] as FlowCategory[],
  },
  {
    key: "mind",
    label: "Mind",
    line: "Mindfulness",
    detail: "Short guided practices for attention, presence and noticing what the body is telling you.",
    categories: ["mind"] as FlowCategory[],
  },
] as const;

export type ToolArmKey = (typeof TOOL_ARMS)[number]["key"];

export const TOOL_CATEGORIES: FlowCategory[] = TOOL_ARMS.flatMap((a) => a.categories);

export function toolArm(key: string | undefined) {
  return TOOL_ARMS.find((a) => a.key === key) ?? TOOL_ARMS[0];
}

export function armForCategory(category: FlowCategory) {
  return TOOL_ARMS.find((a) => a.categories.includes(category)) ?? null;
}
