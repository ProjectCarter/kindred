import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  rankOnThisDayCandidates,
  scoreOnThisDayCandidate,
} from "./scoreCandidate.ts";

Deno.test("scoreOnThisDayCandidate penalizes overfamous clichés", () => {
  const famous = scoreOnThisDayCandidate({
    year: 1969,
    text: "Apollo 11 lands on the Moon with astronauts Neil Armstrong and Buzz Aldrin.",
  });
  const curious = scoreOnThisDayCandidate({
    year: 1929,
    text: "The first color television broadcast was demonstrated to the public in London, surprising audiences with a new way to see the world.",
    pages: [{ thumbnail: { source: "https://example.com/tv.jpg", width: 640 } }],
  });

  assertEquals(curious.editorialScore > famous.editorialScore, true);
});

Deno.test("rankOnThisDayCandidates sorts by editorial score descending", () => {
  const ranked = rankOnThisDayCandidates([
    { year: 1900, text: "A minor administrative boundary was redrawn in a rural province." },
    {
      year: 1877,
      text: "Thomas Edison announced a breakthrough phonograph invention that would change how people heard music for the first time.",
    },
  ]);

  assertEquals(ranked[0]!.year, 1877);
  assertEquals(ranked[0]!.editorialScore >= ranked[1]!.editorialScore, true);
});

Deno.test("scoreOnThisDayCandidate rewards narrative length sweet spot", () => {
  const good = scoreOnThisDayCandidate({
    year: 1851,
    text: "The Great Exhibition opened in London's Crystal Palace, introducing millions of visitors to inventions, art, and engineering from around the world in a single dazzling hall.",
  });
  const thin = scoreOnThisDayCandidate({
    year: 1851,
    text: "An exhibition opened.",
  });

  assertEquals(good.editorialScore > thin.editorialScore, true);
});
