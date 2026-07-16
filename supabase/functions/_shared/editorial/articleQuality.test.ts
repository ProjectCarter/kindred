import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  countBodyParagraphs,
  validateHistoryArticle,
  wordCount,
} from "./articleQuality.ts";

Deno.test("validateHistoryArticle accepts six-paragraph grounded sample", () => {
  const body = [
    "In 1969, Apollo 11 carried three astronauts toward the Moon while television crews scrambled to find enough satellite time for the world to watch live — a detail easy to forget now that streaming fits in a pocket. Families gathered around sets they had bought for baseball season and stayed up past bedtime because the countdown had become a shared appointment.",
    "The Cold War had turned spaceflight into a public contest of nerves. Every launch was politics, engineering, and theater at once, and the American public had learned to treat countdowns like national appointments. Engineers spoke in acronyms on television while commentators tried to translate risk into plain language everyone could follow without looking away.",
    "Neil Armstrong and Buzz Aldrin descended to the lunar surface while Michael Collins orbited above, and Armstrong's first step became the sentence everyone still quotes — even people who cannot name the third astronaut who stayed in the command module. The footage was grainy, the audio delayed, and still it felt like the whole species had leaned forward at once.",
    "At the time, the stakes were immediate: prove a difficult landing could succeed, return the crew safely, and show that a democratic society could organize something this precise without cutting every corner visible on television. A failure would have been more than a lost capsule — it would have been a public argument about competence replayed in every headline for months.",
    "The mission reshaped how governments fund science, how schools teach engineering, and how ordinary people imagine what is possible beyond the atmosphere — not as fantasy, but as a problem with a checklist. Universities expanded aerospace programs, museums built galleries around a few borrowed artifacts, and a generation of children learned the names of rockets before they learned the names of presidents.",
    "Fifty years later, the Moon still feels closer than Mars because Apollo 11 taught a generation to look up and believe the distance could be closed — one small step at a time, and a louder lesson in what careful teams can do under pressure. The footprints remain out of reach for most of us, but the habit of asking 'what if we tried?' stayed behind on Earth — in classrooms, in labs, and in the quiet pride of engineers who still treat checklists as a form of respect.",
  ].join("\n\n");

  const result = validateHistoryArticle(body, 1969, "Apollo 11 Moon landing");
  assert(result.passes, result.reasons.join(", "));
  assertEquals(countBodyParagraphs(body), 6);
  assert(result.words >= 380, `expected 380+ words, got ${result.words}`);
});

Deno.test("validateHistoryArticle rejects thin two-paragraph draft", () => {
  const body = "In 1903, something happened.\n\nHistory still matters today.";
  const result = validateHistoryArticle(body, 1903, "Wright brothers flight");
  assert(!result.passes);
});
