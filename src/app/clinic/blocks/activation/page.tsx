import BlocksListView from "../BlocksListView";

export const dynamic = "force-dynamic";

export default function ActivationBlocksPage() {
  return (
    <BlocksListView
      filterType="activation"
      heading="Activations"
      subheading="Blocks that come first in a workout, reaction and readiness before the main body of the session."
      emptyMessage="No activation blocks yet."
    />
  );
}
