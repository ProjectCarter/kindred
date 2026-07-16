import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  containsBannedEventCopy,
  parseGeneratedEventEditorial,
  validateBanditNote,
} from "./eventEditorial.ts";
import {
  classifyEventStoryType,
  passesEventGoldenTest,
} from "./eventStorytelling.ts";
import type { LocalEvent } from "./provider.ts";

function sampleEvent(overrides: Partial<LocalEvent> = {}): LocalEvent {
  return {
    name: "Watercolor Workshop at Queen Creek Olive Mill",
    startDateTime: "Sat, Jul 19, 6 PM",
    venue: "Queen Creek Olive Mill",
    city: "Queen Creek",
    sourceUrl: "https://example.com/event",
    sourceName: "Eventbrite",
    ...overrides,
  };
}

Deno.test("validateBanditNote rejects permanently banned template phrases", () => {
  assertEquals(
    validateBanditNote("Worth stepping out for — The Nash has something happening tonight."),
    null
  );
  assertEquals(validateBanditNote("Don't miss this perfect evening downtown."), null);
  assertEquals(
    validateBanditNote("Changing Hands always hosts interesting conversations."),
    "Changing Hands always hosts interesting conversations."
  );
});

Deno.test("classifyEventStoryType distinguishes categories", () => {
  assertEquals(
    classifyEventStoryType({
      name: "Gilbert Farmers Market",
      venue: "Downtown Gilbert",
    }),
    "farmers_market"
  );
  assertEquals(
    classifyEventStoryType({
      name: "Jazz at The Nash",
      venue: "The Nash",
      category: "music",
    }),
    "concert"
  );
});

Deno.test("passesEventGoldenTest rejects generic listing-only copy", () => {
  assertEquals(
    passesEventGoldenTest({
      name: "Watercolor Workshop at Queen Creek Olive Mill",
      venue: "Queen Creek Olive Mill",
      banditNote: null,
      editorialBody: ["An event is happening Friday night."],
    }),
    false
  );
  assertEquals(
    passesEventGoldenTest({
      name: "Watercolor Workshop at Queen Creek Olive Mill",
      venue: "Queen Creek Olive Mill",
      banditNote:
        "Queen Creek Olive Mill hosts a watercolor workshop with a seasonal spritz.",
      editorialBody: [
        "Guests paint a desert-inspired landscape during the evening session at Queen Creek Olive Mill.",
        "Instructors at Queen Creek Olive Mill often save the final half hour for sunset light on the patio — tickets and start time are on the listing below.",
      ],
    }),
    true
  );
});

Deno.test("parseGeneratedEventEditorial rejects generic AI phrases and weak takeaways", () => {
  const generic = parseGeneratedEventEditorial(
    {
      banditNote: "Nestled in Queen Creek, this workshop welcomes everyone.",
      editorialBody: [
        "Whether you're a local or visitor, Queen Creek Olive Mill hosts watercolor on Saturday.",
        "In summary, this is a perfect evening for all ages.",
      ],
    },
    sampleEvent()
  );
  assertEquals(generic.banditNote, null);
  assertEquals(generic.editorialBody, null);
});

Deno.test("parseGeneratedEventEditorial rejects unsupported source confidence claims", () => {
  const parsed = parseGeneratedEventEditorial(
    {
      banditNote: "Queen Creek Olive Mill hosts a watercolor workshop on Saturday.",
      editorialBody: [
        "Queen Creek Olive Mill hosts a watercolor workshop on Saturday morning.",
        "Locals love this spot and it is always packed on weekends.",
      ],
    },
    sampleEvent()
  );
  assertEquals(parsed.banditNote, null);
  assertEquals(parsed.editorialBody, null);
});

Deno.test("parseGeneratedEventEditorial rejects banned editorial body paragraphs", () => {
  const parsed = parseGeneratedEventEditorial(
    {
      banditNote: "Queen Creek Olive Mill hosts a pasta class on Saturday.",
      editorialBody: [
        "Queen Creek Olive Mill hosts a pasta class on Saturday morning.",
        "This is the kind of plan that looks unremarkable on paper.",
      ],
    },
    sampleEvent()
  );
  assertEquals(parsed.banditNote, null);
  assertEquals(parsed.editorialBody, null);
  assertEquals(containsBannedEventCopy("Show up with curiosity; that is often enough."), true);
  assertEquals(containsBannedEventCopy("Whether you're a local or visitor, come on down."), true);
});
