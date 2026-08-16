import BlocksListView from "./BlocksListView";

// See the matching comment on src/app/clinic/page.tsx -- this page has no
// dynamic API to trigger dynamic rendering automatically, so without this
// it would freeze at whatever the block list looked like at build time.
export const dynamic = "force-dynamic";

export default function BlocksListPage() {
  return (
    <BlocksListView
      heading="Blocks"
      subheading="Reusable, typed groups of exercises with their own week-to-week progression, the building blocks of a Workout."
      emptyMessage="No blocks yet."
    />
  );
}
