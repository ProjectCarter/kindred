/**
 * Gold-standard Kindred article — Phase 1 editorial blueprint.
 *
 * Craft inspired by the pacing of Smithsonian Smart News science writing
 * (scene → stakes → discovery → evidence → implication), not a reprint.
 * Prose is original to Kindred’s science desk.
 *
 * Open via articleFromLeadStory / GOLD_STANDARD_ARTICLE_ID.
 */

import type { ImageSourcePropType } from "react-native";
import type { KindredArticle } from "../article";
import type { ArticleCompanion, ContinueReadingItem } from "../articleCompanion";
import { estimateArticleReadMinutes, withContentSystem } from "../article";
import type { EditorialFieldAnswers } from "../contentSystem";

export const GOLD_STANDARD_ARTICLE_ID = "kindred-gold-science-algal-bloom";

const PHOTO = {
  shore: require("../../../assets/heroes/hero-beach-morning.jpg") as ImageSourcePropType,
  horizon: require("../../../assets/heroes/hero-summer-sunrise.jpg") as ImageSourcePropType,
  quiet: require("../../../assets/heroes/hero-default-morning.jpg") as ImageSourcePropType,
};

/**
 * One perfected magazine story — every paragraph earns its place.
 */
export function getGoldStandardArticle(
  options?: { id?: string }
): KindredArticle {
  const body = [
    "In March of last year, a strange yellow foam began to gather along Waitpinga Beach in South Australia. It looked almost harmless at first — the kind of sea scum a tide leaves and the sun burns away. Then swimmers walked out of the water with cold-and-flu symptoms. Leafy seadragons, those delicate emblems of the southern coast, washed up dead or dying among the ordinary fish.",

    "What followed was not a single bad week at the shore. Over fifteen months, an estimated one million fish, birds, shellfish, and marine mammals died across more than 7,700 square miles — roughly a third of South Australia’s coastline. Beaches that had always meant weekends and salt air became places people avoided. The ocean, for a stretch of the map, felt wrong.",

    "Scientists have now named the chief culprit: Karenia cristata, a rare microscopic alga that produces brevetoxins — compounds that interfere with nerve cells. In a study published July 6 in Nature Ecology & Evolution, researchers report that K. cristata appears to be the most toxic algal species ever tested. Even in vanishingly small concentrations, it can kill.",

    "The hunt for a culprit",

    "Algal blooms are not new. Hundreds of microalgae can turn dangerous when they multiply in dense clouds, staining water and starving marine life of oxygen or flooding it with toxins. What made this bloom different was how little anyone knew about the organism at its center. Before it appeared in Australian waters, K. cristata had been identified only near South Africa and Newfoundland. South Australia was a first — and a shock.",

    "A team of researchers, many of them based in Australia, set out to learn the alga on its own terms. Under a powerful microscope they compared its cells with other members of the Karenia genus. They built new molecular tools so that water samples could be sorted species by species, not guessed at from a foam line on the sand.",

    "Those samples told a clear story. Five Karenia species were present in the bloom. K. cristata dominated. Notably absent was K. brevis — the better-known brevetoxin producer behind Florida’s infamous red tides. The devastation off South Australia was not a familiar villain in a new place. It was a rarer one, working with uncommon force.",

    "A toxicity without precedent",

    "In the laboratory, the team grew K. cristata and tested it against cells from fish and invertebrates, including plankton. The results, some co-authors later wrote, were startling. The alga killed half the invertebrates in their trials even at extremely low concentrations. Lab-grown fish gill cells fared little better.",

    "Toxicity showed up at roughly 148 cells per fluid ounce — about 19,000 cells per gallon. Out in the field, during the height of the bloom, seawater samples routinely held far more. In August and September, some readings topped 3.8 million cells per gallon.",

    "That line from marine biologist Shauna Murray of the University of Technology Sydney is the kind of sentence that rearranges a field. For environmental scientist Craig Styan of Adelaide University, the numbers finally matched what beaches had already shown: “For the first time, it gives us an explanation for why this bloom was so devastating out in the field.”",

    "What we still do not know",

    "Researchers still argue over what tips a quiet stretch of water into a bloom — wind, currents, temperature, extreme weather, nutrient runoff from farms and lawns. The list is long; the certainty is short. Until now, many assumed K. brevis was the most dangerous brevetoxin producer, and that its worst blooms preferred warmer seas. K. cristata unsettles both assumptions. It can be deadlier. It can thrive in cooler water.",

    "Don Anderson, a physiological ecologist at Woods Hole Oceanographic Institution who was not involved in the study, put the unease plainly: the finding makes him wonder where else the problem will appear.",

    "The next work is less dramatic than a beach covered in foam, and more important. Scientists want the specific conditions that let K. cristata explode along South Australia’s coast, and the precise biology behind its potency. “There’s an awful lot we need to still understand about the basic biology of the algae,” Styan told the Australian Broadcasting Corporation.",

    "For readers far from Waitpinga Beach, the lesson is not panic. It is attention. The ocean’s smallest lives can redraw a coastline. When they do, the difference between a mystery and a map is careful science — and the patience to keep looking after the foam is gone.",
  ];

  const article: KindredArticle = {
    id: options?.id ?? GOLD_STANDARD_ARTICLE_ID,
    section: "science",
    headline:
      "The rare alga behind South Australia’s deadly bloom may be the most toxic ever tested",
    dek: "Karenia cristata produces nerve toxins so potent that even sparse concentrations can kill — and it has remade a coastline.",
    byline: "Kindred Science Desk",
    source: "Kindred",
    publishedAt: new Date().toISOString(),
    banditNote:
      "I kept this one for the quiet dread in the opening — foam on a familiar beach — and for the patience of the science that followed. Worth reading slowly.",
    heroImage: {
      source: PHOTO.shore,
      caption:
        "A southern shoreline after the tide. In South Australia, foam and die-offs marked more than a rough season at the beach.",
      credit: "Kindred editorial archive",
      kind: "editorial",
    },
    figures: [
      {
        source: PHOTO.horizon,
        caption:
          "Open water holds its secrets at a scale the eye cannot see — until a bloom writes them on the sand.",
        credit: "Kindred editorial archive",
        afterParagraph: 6,
      },
      {
        source: PHOTO.quiet,
        caption:
          "After the foam thins, the questions remain: what tipped the water, and where might it tip next?",
        credit: "Kindred editorial archive",
        afterParagraph: 13,
      },
    ],
    body,
    pullQuote:
      "Karenia cristata is an order of magnitude more toxic than the next most toxic microalgae that has been studied to date.",
    sourceUrl:
      "https://www.smithsonianmag.com/smart-news/the-culprit-behind-south-australias-deadly-algal-bloom-might-be-the-most-toxic-species-ever-tested-scientists-say-180989100/",
    contentType: "science",
  };

  const scienceAnswers: EditorialFieldAnswers = {
    the_finding:
      "A rare alga, Karenia cristata, produced brevetoxins strong enough to help explain a vast marine die-off along South Australia’s coast.",
    how_we_know:
      "Researchers matched bloom samples to the species under the microscope, built molecular tools to sort Karenia cell by cell, and tested toxicity in the lab against fish and invertebrate cells.",
    why_it_matters:
      "The bloom killed on a scale that emptied beaches of their ordinary meaning — and showed that a lesser-known organism can out-poison the red-tide species the world already fears.",
    open_questions:
      "What tipped the water into bloom, and where else K. cristata might appear, remain open. The next work is conditions, biology, and earlier warning.",
  };

  article.estimatedReadMinutes = estimateArticleReadMinutes(article);
  return withContentSystem(article, { answers: scienceAnswers });
}

function relatedItem(
  partial: Omit<ContinueReadingItem, "label"> & { label?: string }
): ContinueReadingItem {
  return {
    label: partial.label ?? "Related",
    ...partial,
  };
}

/** Companion tuned so the end of the story pulls the reader onward. */
export function getGoldStandardCompanion(): ArticleCompanion {
  const banditNote =
    "I kept this one for the quiet dread in the opening — foam on a familiar beach — and for the patience of the science that followed. Worth reading slowly.";

  return {
    whyThisMatters: {
      title: "Why this matters",
      summary:
        "A coastline’s health can turn on organisms too small to see — and the science that names them is how communities learn what they are swimming in.",
    },
    whyChosen: banditNote,
    banditNote,
    knowledgeNotes: [],
    knowledgeCards: [],
    continueReading: [
      relatedItem({
        kind: "background",
        label: "Background",
        title: "Why “red tide” became a household warning in Florida",
        summary:
          "Another Karenia story — warmer water, brevetoxins, and beaches that close when the wind turns wrong. The contrast makes South Australia’s cooler bloom sharper.",
        editorWhy:
          "Same family of toxins, different ocean — useful after the piece you just finished.",
        targetArticleId: "gold-related-florida-red-tide",
      }),
      relatedItem({
        kind: "following",
        label: "The wider pattern",
        title: "Can we forecast algal blooms the way we forecast weather?",
        summary:
          "Wind, heat, and runoff leave clues. Scientists are trying to turn those clues into warnings before foam hits the sand.",
        editorWhy: "The natural next question after a bloom with no easy cause.",
        targetArticleId: "gold-related-bloom-forecast",
      }),
      relatedItem({
        kind: "local",
        label: "Closer to home",
        title: "When freshwater blooms turn a familiar lake strange",
        summary:
          "Inland waters have their own microscopic seasons. A calm look at what changing summers mean for lakes people actually use.",
        editorWhy: "Brings the ocean story back to water you might know by name.",
        targetArticleId: "gold-related-freshwater",
      }),
      relatedItem({
        kind: "bandit",
        label: "Bandit’s Pick",
        title: "A morning walk on a quiet shore — while it is still quiet",
        summary:
          "Not a warning. A reminder: the ordinary beach is worth noticing before anything goes wrong.",
        editorWhy: "After heavy science, something human and local to hold.",
        targetArticleId: "gold-bandit-shore-walk",
      }),
      relatedItem({
        kind: "edition",
        label: "Return to today’s edition",
        title: "Return to Today’s Paper",
        summary: "The rest of today’s morning paper is waiting.",
        action: "return_to_edition",
      }),
    ],
  };
}

/** Short related pieces — still edited, never placeholder paste. */
export function getGoldRelatedArticle(
  targetId: string
): KindredArticle | null {
  if (targetId === "gold-related-florida-red-tide") {
    const article: KindredArticle = {
      id: targetId,
      section: "science",
      headline: "Why “red tide” became a household warning in Florida",
      dek: "K. brevis blooms taught a coastline to watch the wind — and to close beaches when the water turns.",
      byline: "Kindred Science Desk",
      source: "Kindred",
      publishedAt: new Date().toISOString(),
      banditNote:
        "Read this beside the South Australia piece — same toxin family, different sea.",
      heroImage: {
        source: PHOTO.horizon,
        caption: "Warm water and a shifting wind can close a beach by afternoon.",
        credit: "Kindred editorial archive",
        kind: "editorial",
      },
      body: [
        "In Florida, red tide is not a metaphor. It is a season some years arrive with, when Karenia brevis multiplies and brevetoxins ride the spray. Fish die. Beach towns empty. People with asthma learn which mornings to stay inside.",

        "The species is better studied than K. cristata, and its reputation is hard-earned. Warmth helps it. Wind decides who breathes the aerosol. For coastal communities, the bloom is both ecology and economy — a reminder that microscopic lives write rules for the shore.",

        "Set beside South Australia’s cooler, rarer bloom, Florida’s red tide is not a duplicate. It is a rhyme: different water, related poison, same need for clear names and early attention.",
      ],
      pullQuote: null,
      figures: null,
      sourceUrl: null,
    };
    article.estimatedReadMinutes = estimateArticleReadMinutes(article);
    return article;
  }

  if (targetId === "gold-related-bloom-forecast") {
    const article: KindredArticle = {
      id: targetId,
      section: "science",
      headline: "Can we forecast algal blooms the way we forecast weather?",
      dek: "The ingredients are visible. The warning systems are still catching up.",
      byline: "Kindred Science Desk",
      source: "Kindred",
      publishedAt: new Date().toISOString(),
      banditNote: "The practical hope after a hard science story.",
      heroImage: {
        source: PHOTO.quiet,
        caption: "Forecasts begin as patterns — then become decisions on a pier.",
        credit: "Kindred editorial archive",
        kind: "editorial",
      },
      body: [
        "Weather forecasting once felt like folklore. Then instruments, models, and satellites made tomorrow’s storm something you could plan around. Scientists who study algal blooms want a version of that certainty — not perfection, but enough lead time to move boats, close beaches, or protect shellfish beds.",

        "The clues are familiar: heat, calm water, nutrient pulses after rain, currents that gather rather than scatter. Turning clues into a forecast means watching many places at once and admitting what still cannot be predicted. South Australia’s bloom, driven by a species few expected there, is exactly the sort of surprise a good system must learn from.",

        "The goal is modest and urgent. Not to tame the ocean — only to hear it sooner.",
      ],
      pullQuote: null,
      figures: null,
      sourceUrl: null,
    };
    article.estimatedReadMinutes = estimateArticleReadMinutes(article);
    return article;
  }

  if (targetId === "gold-related-freshwater") {
    const article: KindredArticle = {
      id: targetId,
      section: "science",
      headline: "When freshwater blooms turn a familiar lake strange",
      dek: "Inland water has its own microscopic summers — and people notice when the swimming season shrinks.",
      byline: "Kindred Science Desk",
      source: "Kindred",
      publishedAt: new Date().toISOString(),
      banditNote: "For anyone whose summer has a lake in it.",
      heroImage: {
        source: PHOTO.shore,
        caption: "A lake looks still until the color of the water changes.",
        credit: "Kindred editorial archive",
        kind: "editorial",
      },
      body: [
        "Not every bloom is marine. Freshwater cyanobacteria can paint a reservoir green and close a swimming beach by noon. Dogs have died after drinking the wrong edge of a pond. Families learn new habits: check the advisory, trust the smell, leave when the water looks like paint.",

        "Warming summers and nutrient runoff do not invent these organisms; they tip the odds. The science is local and practical — testing kits, township notices, the quiet decision to cancel a picnic. After a story about a distant coastline, this is the version that may live nearer to home.",
      ],
      pullQuote: null,
      figures: null,
      sourceUrl: null,
    };
    article.estimatedReadMinutes = estimateArticleReadMinutes(article);
    return article;
  }

  if (targetId === "gold-bandit-shore-walk") {
    const article: KindredArticle = {
      id: targetId,
      section: "bandits_pick",
      headline: "A morning walk on a quiet shore — while it is still quiet",
      dek: "After a hard science story, a simple invitation: notice the ordinary beach.",
      byline: "Bandit",
      source: "Kindred",
      publishedAt: new Date().toISOString(),
      banditNote: "This is the palate cleanser. Go if you can.",
      heroImage: {
        source: PHOTO.shore,
        caption: "Low tide, no agenda — the best kind of morning errand.",
        credit: "Kindred editorial archive",
        kind: "editorial",
      },
      body: [
        "You do not need a rare alga to owe the ocean a little attention. A short walk at low tide will do: the sound, the cold on your ankles, the way the light changes when a cloud moves.",

        "Read the science. Then, if you live near water, take twenty minutes and look at it without asking it to perform. The bloom stories matter because the ordinary shore matters first.",
      ],
      pullQuote: null,
      figures: null,
      sourceUrl: null,
    };
    article.estimatedReadMinutes = estimateArticleReadMinutes(article);
    return article;
  }

  return null;
}

export function isGoldStandardArticleId(id: string): boolean {
  return (
    id === GOLD_STANDARD_ARTICLE_ID ||
    id.startsWith("gold-related-") ||
    id === "gold-bandit-shore-walk"
  );
}
