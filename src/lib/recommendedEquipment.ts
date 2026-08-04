export type RecommendedEquipmentItem = {
  slug: string;
  name: string;
  // One or two plain sentences: what it's for, no invented specs or brand claims.
  note: string;
  // Optional extra guidance specific to this item (e.g. which variant to
  // use for which kind of drill) -- shown under the main note, not invented.
  notes?: string;
  // Real product photo from the supplier's own listing, dropped into
  // /public/equipment -- omitted (renders text-only) until one exists.
  image?: string;
  supplierName: string;
  supplierUrl: string;
};

// A small, hand-kept list, same pattern as src/lib/shopSections.ts -- add an
// item by adding an entry here, nothing else needs to change. Athena Online
// never sells equipment itself; every link here goes to a third party.
export const RECOMMENDED_EQUIPMENT: RecommendedEquipmentItem[] = [
  {
    slug: "resistance-bands",
    name: "Core Balance Resistance Bands (Latex)",
    note: "A set of graded bands covers most of the loaded work you'll be asked to do at home, from light isometric holds through to heavier progressions.",
    notes:
      "Most rehab and strength drills use a red band (7 to 15kg). Mobilisation drills more often use a green band (22 to 56kg). Bands are typically colour coded red, black, purple, green, in order of increasing resistance.",
    image: "/equipment/resistance-bands.png",
    supplierName: "Decathlon",
    supplierUrl:
      "https://www.decathlon.co.uk/p/mp/pull-up-resistance-band-exercise-fitness-latex-light-7-to-15kg-core-balance/81f60c58-0d1a-4227-8bfb-6e2266a71a7e/c14",
  },
  {
    slug: "yoga-wedge",
    name: "Yoga Wedge",
    note: "An ideal tool for foot support during balance and stability drills.",
    image: "/equipment/yoga-wedge.png",
    supplierName: "Decathlon",
    supplierUrl:
      "https://www.decathlon.co.uk/p/mp/yoga-studio-eva-foam-wedges-pair-2-x-pack-teal/0249a47e-bef3-474c-89df-381ed512ca31/c98",
  },
  {
    slug: "long-loop-resistance-bands",
    name: "Long Loop Resistance Bands",
    note: "These super long fabric bands are ideal for outdoor and partner drills.",
    image: "/equipment/long-loop-resistance-bands.png",
    supplierName: "Perform Better",
    supplierUrl: "https://performbetter.co.uk/products/flexvit-resistance-bands",
  },
  {
    slug: "suspension-trainer",
    name: "Home Suspension Trainer",
    note: "This packable and robust suspension trainer is ideal for over door home use.",
    image: "/equipment/suspension-trainer.png",
    supplierName: "Decathlon",
    supplierUrl: "https://www.decathlon.co.uk/p/suspension-trainer-black-blue/336337/c382c98c227m8667958",
  },
  {
    slug: "weighted-yoga-balls",
    name: "Weighted Yoga Balls",
    note: "These weighted balls are great for upper limb rehab.",
    supplierName: "Decathlon",
    supplierUrl:
      "https://www.decathlon.co.uk/p/mp/weighted-toning-balls-yoga-pilates-rehab-exercise-soft-feel-pvc-2-x-0-5kg-1-5kg/7bb2fb80-138b-4e15-a54a-0f358765cccb/c255",
  },
  {
    slug: "foam-roller",
    name: "90cm Foam Roller",
    note: "A long foam roller is a versatile tool for rehab and strength work. Cheaper options are commonly less rigid.",
    image: "/equipment/foam-roller.png",
    supplierName: "Decathlon",
    supplierUrl: "https://www.decathlon.co.uk/p/pilates-foam-roller-length-90-cm-diameter-15-cm-black/358134/m8912834",
  },
  {
    slug: "weighted-vest",
    name: "Weighted Vest (6 to 10kg)",
    note: "A great way to add load without upper limb strain.",
    image: "/equipment/weighted-vest.png",
    supplierName: "Decathlon",
    supplierUrl: "https://www.decathlon.co.uk/p/adjustable-weight-training-weighted-vest-6-to-10-kg/344654/c382m8786091",
  },
  {
    slug: "kettlebell-10kg",
    name: "10kg Kettlebell (Cast)",
    note: "Plastic options are available, but nothing beats the feel and durability of metal. 10kg covers most activities.",
    image: "/equipment/kettlebell-10kg.png",
    supplierName: "Decathlon",
    supplierUrl:
      "https://www.decathlon.co.uk/p/mp/cast-iron-kettlebells-10kg/71be45e9-bd51-4b9c-b085-d5be6bb0e468/c1",
  },
  {
    slug: "hip-thruster-bench",
    name: "Hip Thruster Bench",
    note: "This foam bench creates a cheap, light and storable alternative to a conventional gym bench for home use.",
    image: "/equipment/hip-thruster-bench.png",
    supplierName: "Perform Better",
    supplierUrl: "https://performbetter.co.uk/products/hip-thrust-bench?variant=55093509783925",
  },
];
