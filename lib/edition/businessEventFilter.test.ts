import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assessBusinessProfessionalListing,
  isBusinessProfessionalEventCard,
  filterNonBusinessEventCards,
} from "./businessEventFilter.ts";

const EXCLUDE_TITLES = [
  "Business Analytics & Strategy 1 Day Training",
  "Project Management Techniques",
  "Build Your Client Base",
  "Entrepreneur Networking Mixer",
  "Leadership Development Seminar",
  "Digital Marketing Workshop",
  "Business Seminar: Growth Fundamentals",
  "Professional Development Workshop",
  "Corporate Training Intensive",
  "Sales Training Bootcamp",
  "Marketing Training Masterclass",
  "Finance Training for Managers",
  "Accounting Training Session",
  "Startup Founders Meetup",
  "Career Fair 2026",
  "Job Fair — Hiring Event",
  "Real Estate Investing Seminar",
  "Continuing Education for Realtors",
  "Executive Coaching Program",
  "Chamber of Commerce Monthly Meeting",
  "Coworking Open House",
  "B2B Lead Generation Summit",
];

const KEEP_TITLES = [
  "Summer Concert in the Park",
  "Downtown Food & Wine Festival",
  "Gilbert Farmers Market",
  "Watercolor Painting Workshop",
  "Beginner Pottery Class",
  "Sourdough Baking Class",
  "Fall Gardening Workshop",
  "Family Movie Night",
  "Comedy Night at the Improv",
  "Community Theater: Our Town",
  "5K Charity Run",
  "Holiday Tree Lighting Parade",
  "Museum Exhibit Opening",
  "Live Jazz at the Amphitheater",
  "Kids Craft Fair",
  "Yoga in the Park",
];

test("excludes business / professional-development events", () => {
  for (const name of EXCLUDE_TITLES) {
    const assessment = assessBusinessProfessionalListing({ name });
    assert.equal(
      assessment.excluded,
      true,
      `expected EXCLUDE: "${name}" (signal=${assessment.signal ?? "none"})`
    );
  }
});

test("keeps concerts, festivals, and public hobby/arts/recreation events", () => {
  for (const name of KEEP_TITLES) {
    const assessment = assessBusinessProfessionalListing({ name });
    assert.equal(
      assessment.excluded,
      false,
      `expected KEEP: "${name}" (signal=${assessment.signal ?? "none"})`
    );
  }
});

test("excludes office-promotion events by venue/organizer context", () => {
  assert.equal(
    assessBusinessProfessionalListing({
      name: "Community Gathering",
      venue: "Regus Gilbert",
    }).excluded,
    true
  );
  assert.equal(
    assessBusinessProfessionalListing({
      name: "A Sports Night",
      venue: "Regus Downtown",
      organizer: "Regus",
    }).excluded,
    true,
    "office-promotion at Regus excluded even when titled as a sports night"
  );
  assert.equal(
    assessBusinessProfessionalListing({
      name: "Networking Happy Hour",
      organizer: "Skelora",
    }).excluded,
    true
  );
});

test("card-level helper and list filter operate on LocalEventCard shape", () => {
  const cards = [
    { name: "Leadership Development Seminar", venue: "Convention Center" },
    { name: "Summer Concert in the Park", venue: "Freestone Park" },
    { name: "Entrepreneur Networking Mixer", venue: "Regus" },
    { name: "Watercolor Painting Workshop", venue: "Art Center" },
  ];

  assert.equal(isBusinessProfessionalEventCard(cards[0]), true);
  assert.equal(isBusinessProfessionalEventCard(cards[1]), false);

  const kept = filterNonBusinessEventCards(cards);
  assert.deepEqual(
    kept.map((c) => c.name),
    ["Summer Concert in the Park", "Watercolor Painting Workshop"]
  );
});
