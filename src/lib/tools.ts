// The Tools tab of the client's app: a hub of resources the client can
// open at any time, outside their programme. It uses the same hexagons as
// My Passport, one per area, and each area shows the live Flows from the
// Vault that belong to it. Safe to use in the browser and on the server.
//
// A Flow belongs to an area in one of two ways: its "Where it shows on the
// client's Tools tab" setting in the Vault, or, when that is left to follow
// its type, the types listed against each area below. To rename an area or
// change which types it collects, edit TOOL_ARMS. Nothing else needs to
// change. Three or four areas both draw correctly as hexagons.

import type { Flow, FlowCategory, ToolsArea } from "./flows";

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
    line: "Neuro and resets",
    detail: "Nerve glides, eye and balance drills, and short resets for the desk and for travel.",
    categories: ["neurodynamic"] as FlowCategory[],
  },
  {
    key: "mind",
    label: "Mind",
    line: "Mindfulness",
    detail: "Short guided practices for attention, presence and noticing what the body is telling you.",
    categories: ["mind"] as FlowCategory[],
  },
  {
    key: "recovery",
    label: "Recovery",
    line: "Recovery and sleep",
    detail: "Practices for winding down after load, at the end of the day, and before sleep.",
    categories: ["recovery"] as FlowCategory[],
  },
] as const;

export type ToolArmKey = (typeof TOOL_ARMS)[number]["key"];

export function toolArm(key: string | undefined) {
  return TOOL_ARMS.find((a) => a.key === key) ?? TOOL_ARMS[0];
}

/** The area a Flow shows under on the Tools tab, or null if none. */
export function armForFlow(flow: Pick<Flow, "category"> & { toolsArea: ToolsArea }) {
  if (flow.toolsArea) return TOOL_ARMS.find((a) => a.key === flow.toolsArea) ?? null;
  return TOOL_ARMS.find((a) => a.categories.includes(flow.category)) ?? null;
}
