import BlocksListView from "../BlocksListView";

export const dynamic = "force-dynamic";

export default function InjuryPreventionBlocksPage() {
  return (
    <BlocksListView
      filterType="injury_prevention"
      heading="Injury Preventions"
      subheading="Blocks that come first in a workout, targeted work for the area that needs it before the main body of the session."
      emptyMessage="No injury prevention blocks yet."
    />
  );
}
