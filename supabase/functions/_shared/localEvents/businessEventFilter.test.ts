import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assessBusinessProfessionalListing,
  filterNonBusinessEvents,
} from "./businessEventFilter.ts";
import type { LocalEvent } from "./provider.ts";

const EXCLUDE_TITLES = [
  "Business Analytics & Strategy 1 Day Training",
  "Project Management Techniques",
  "Build Your Client Base",
  "Entrepreneur Networking Mixer",
  "Leadership Development Seminar",
  "Digital Marketing Workshop",
  "Professional Development Workshop",
  "Corporate Training Intensive",
  "Sales Training Bootcamp",
  "Career Fair 2026",
  "Real Estate Investing Seminar",
  "Chamber of Commerce Monthly Meeting",
];

const KEEP_TITLES = [
  "Summer Concert in the Park",
  "Gilbert Farmers Market",
  "Watercolor Painting Workshop",
  "Beginner Pottery Class",
  "Fall Gardening Workshop",
  "Comedy Night at the Improv",
  "5K Charity Run",
  "Museum Exhibit Opening",
];

Deno.test("assessBusinessProfessionalListing excludes business/professional events", () => {
  for (const name of EXCLUDE_TITLES) {
    assertEquals(
      assessBusinessProfessionalListing({ name }).excluded,
      true,
      `expected EXCLUDE: ${name}`
    );
  }
});

Deno.test("assessBusinessProfessionalListing keeps public hobby/arts/recreation events", () => {
  for (const name of KEEP_TITLES) {
    assertEquals(
      assessBusinessProfessionalListing({ name }).excluded,
      false,
      `expected KEEP: ${name}`
    );
  }
});

Deno.test("filterNonBusinessEvents removes business listings, keeps valid events", () => {
  const mk = (name: string, venue = ""): LocalEvent =>
    ({ name, venue } as unknown as LocalEvent);
  const events = [
    mk("Leadership Development Seminar"),
    mk("Summer Concert in the Park", "Freestone Park"),
    mk("Community Gathering", "Regus Gilbert"),
    mk("Watercolor Painting Workshop", "Art Center"),
  ];
  const result = filterNonBusinessEvents(events);
  assertEquals(result.kept.map((e) => e.name), [
    "Summer Concert in the Park",
    "Watercolor Painting Workshop",
  ]);
  assertEquals(result.filteredCount, 2);
});
