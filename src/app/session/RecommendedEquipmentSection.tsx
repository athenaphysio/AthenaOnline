import Link from "next/link";
import shopStyles from "../shop/shop.module.css";

// Its own standalone section now, sitting directly after Free Resources
// and directly before Explore -- used to be tucked inside ExploreSection's
// own tile grid.
export default function RecommendedEquipmentSection() {
  return (
    <Link href="/equipment" className={shopStyles.equipmentLink}>
      Recommended equipment →
    </Link>
  );
}
