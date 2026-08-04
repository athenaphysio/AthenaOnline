export type BookingLocation = {
  slug: string;
  name: string;
  place: string;
  // Name of the third party booking system the link goes to (shown as a
  // small label, not a claim about how it works).
  system: string;
  url: string;
};

// Two practices, two separate booking systems -- this page just points to
// them, no booking logic lives here. Add a location by adding an entry.
export const BOOKING_LOCATIONS: BookingLocation[] = [
  {
    slug: "the-forge-clinic",
    name: "The Forge Clinic",
    place: "Richmond upon Thames",
    system: "Cliniko",
    url: "https://the-forge-clinic.uk1.cliniko.com/bookings#service",
  },
  {
    slug: "athena-physiotherapy",
    name: "Athena Physiotherapy",
    place: "Cobham",
    system: "Setmore",
    url: "https://athenaphysio.setmore.com/drdavid",
  },
];
