import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolveStateAtAGlance,
  resolveStateAtAGlanceForPlace,
  stateAtAGlanceCellWidth,
  stateAtAGlanceEditorialImageHeight,
  stateAtAGlanceEditorialImageWidth,
  stateAtAGlanceSymbolOrder,
  stateCodeFromMetroKey,
  stateCodeFromStateField,
  resolveStateSymbolImageUri,
} from "./stateAtAGlance.ts";
import { US_STATE_CODES } from "./stateAtAGlanceFacts.ts";
import { isVerifiedStateSymbolImageUrl } from "./stateAtAGlanceImage.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const gilbert = JSON.parse(
  readFileSync(
    path.join(__dirname, "../../content/city-articles/gilbert-az.json"),
    "utf8"
  )
);

test("stateCodeFromMetroKey extracts trailing state abbreviation", () => {
  assert.equal(stateCodeFromMetroKey("gilbert-az"), "AZ");
  assert.equal(stateCodeFromMetroKey("seattle-wa"), "WA");
  assert.equal(stateCodeFromMetroKey("san-diego-ca"), "CA");
  assert.equal(stateCodeFromMetroKey(null), null);
});

test("resolveStateAtAGlance returns verified Arizona symbols for Gilbert", () => {
  const glance = resolveStateAtAGlance("gilbert-az");
  assert.ok(glance);
  assert.equal(glance!.sectionTitle, "Arizona at a Glance");
  assert.match(glance!.statehood, /February 14, 1912 • 48th State/);
  assert.equal(glance!.nickname, "The Grand Canyon State");
  assert.equal(glance!.motto, "Ditat Deus");
  assert.equal(glance!.capital, "Phoenix");
  assert.ok(glance!.capitol);
  assert.equal(glance!.capitol!.name, "Arizona State Capitol");
  assert.equal(stateAtAGlanceSymbolOrder(glance!).length, 5);
  assert.equal(stateAtAGlanceSymbolOrder(glance!)[0].name, "Arizona State Capitol");
  assert.equal(glance!.symbols.bird!.name, "Cactus Wren");
  assert.equal(glance!.symbols.flower!.name, "Saguaro Blossom");
});

test("resolveStateAtAGlance returns verified Washington symbols for Seattle", () => {
  const glance = resolveStateAtAGlance("seattle-wa");
  assert.ok(glance);
  assert.equal(glance!.sectionTitle, "Washington at a Glance");
  assert.match(glance!.statehood, /November 11, 1889 • 42nd State/);
  assert.equal(glance!.nickname, "The Evergreen State");
  assert.equal(glance!.capital, "Olympia");
  assert.ok(glance!.capitol);
  assert.equal(glance!.capitol!.name, "Washington State Capitol");
  assert.equal(stateAtAGlanceSymbolOrder(glance!).length, 5);
  assert.equal(stateAtAGlanceSymbolOrder(glance!)[0].name, "Washington State Capitol");
  assert.equal(glance!.symbols.bird!.name, "Willow Goldfinch");
  assert.equal(glance!.symbols.tree!.name, "Western Hemlock");
  assert.equal(glance!.symbols.flower!.name, "Coast Rhododendron");
});

test("resolveStateAtAGlance returns verified text facts for every U.S. state", () => {
  assert.equal(US_STATE_CODES.length, 50);
  for (const code of US_STATE_CODES) {
    const glance = resolveStateAtAGlanceForPlace({ state: code });
    assert.ok(glance, `expected glance for ${code}`);
    assert.equal(glance!.stateCode, code);
    assert.ok(glance!.statehood.trim());
    assert.ok(glance!.nickname.trim());
    assert.ok(glance!.capital.trim());
  }
});

test("states without approved symbol assets still show text-only glance", () => {
  const glance = resolveStateAtAGlance("austin-tx");
  assert.ok(glance);
  assert.equal(glance!.stateName, "Texas");
  assert.match(glance!.statehood, /December 29, 1845 • 28th State/);
  assert.equal(glance!.nickname, "The Lone Star State");
  assert.equal(glance!.motto, "Friendship");
  assert.equal(glance!.capital, "Austin");
  assert.equal(stateAtAGlanceSymbolOrder(glance!).length, 0);
});

test("resolveStateAtAGlance omits non-U.S. state codes", () => {
  assert.equal(resolveStateAtAGlanceForPlace({ state: "XX" }), null);
});

test("resolveStateAtAGlanceForPlace resolves from place state field", () => {
  const glance = resolveStateAtAGlanceForPlace({ state: "AZ" });
  assert.ok(glance);
  assert.equal(glance!.stateCode, "AZ");
  assert.equal(glance!.motto, "Ditat Deus");
});

test("stateCodeFromStateField normalizes two-letter abbreviations", () => {
  assert.equal(stateCodeFromStateField("az"), "AZ");
  assert.equal(stateCodeFromStateField(" Washington "), null);
});

test("gilbert metro key resolves Arizona glance data", () => {
  const glance = resolveStateAtAGlance(gilbert.metroKey);
  assert.ok(glance);
  assert.equal(glance!.stateName, "Arizona");
});

test("article adapter wires resolveStateAtAGlance for story_of sections", () => {
  const source = readFileSync(
    path.join(__dirname, "./article.ts"),
    "utf8"
  );
  assert.match(source, /resolveStateAtAGlance/);
  assert.match(source, /stateAtAGlance\?:/);
  assert.match(source, /isStoryOfSection\(section\.section_type\)/);
});

test("history article adapter wires state glance from place state", () => {
  const source = readFileSync(
    path.join(__dirname, "./historyAroundTown/article.ts"),
    "utf8"
  );
  assert.match(source, /resolveStateAtAGlanceForPlace/);
  assert.match(source, /state: snapshot\.state/);
});

test("stateAtAGlance grid cells stay equal width on narrow screens", () => {
  const phoneWidth = 320;
  const tabletWidth = 768;
  assert.equal(stateAtAGlanceCellWidth(phoneWidth), 153);
  assert.equal(stateAtAGlanceCellWidth(tabletWidth), 377);
  assert.ok(stateAtAGlanceCellWidth(phoneWidth) > 0);
});

test("StoryOfSection preview does not reference state glance UI", () => {
  const source = readFileSync(
    path.join(__dirname, "../../components/StoryOfSection.tsx"),
    "utf8"
  );
  assert.doesNotMatch(source, /StateAtAGlance/);
  assert.doesNotMatch(source, /stateAtAGlance/);
});

test("every published state symbol image uses a verified upload.wikimedia.org URL", () => {
  for (const metroKey of ["gilbert-az", "seattle-wa"]) {
    const glance = resolveStateAtAGlance(metroKey);
    assert.ok(glance, `expected glance for ${metroKey}`);
    for (const symbol of stateAtAGlanceSymbolOrder(glance!)) {
      const uri = resolveStateSymbolImageUri(symbol.image);
      assert.ok(uri, `${symbol.name} missing image URI`);
      assert.ok(
        isVerifiedStateSymbolImageUrl(uri),
        `${symbol.name} URL failed verification: ${uri}`
      );
    }
  }
});

test("capitol leads the symbol grid before flag bird tree and flower", () => {
  const glance = resolveStateAtAGlance("gilbert-az");
  assert.ok(glance);
  const order = stateAtAGlanceSymbolOrder(glance!);
  assert.equal(order[0].label, "State Capitol");
  assert.equal(order[1].label, "State Flag");
  assert.equal(order[2].label, "State Bird");
  assert.equal(order[3].label, "State Tree");
  assert.equal(order[4].label, "State Flower");
});

test("StateAtAGlanceSection omits symbol blocks when no approved assets exist", () => {
  const source = readFileSync(
    path.join(__dirname, "../../components/StateAtAGlanceSection.tsx"),
    "utf8"
  );
  assert.match(source, /symbols\.length > 0/);
  assert.doesNotMatch(source, /Photograph unavailable/);
});

test("HistoryPlaceReader renders editorial state glance after Did You Know", () => {
  const source = readFileSync(
    path.join(__dirname, "../../components/HistoryPlaceReader.tsx"),
    "utf8"
  );
  const didYouKnowIdx = source.indexOf('heading="Did You Know?"');
  const glanceIdx = source.indexOf('layout="editorial"');
  const whyRememberIdx = source.indexOf('heading="Why We Remember"');
  const nearbyIdx = source.indexOf('heading="Nearby"');
  assert.ok(didYouKnowIdx >= 0);
  assert.ok(glanceIdx > didYouKnowIdx);
  assert.ok(whyRememberIdx > glanceIdx);
  assert.equal(nearbyIdx, -1);
  // The History Around Town reader ends cleanly with a single "Back to Homepage"
  // link — no editorial colophon / "Continue Reading" closing block.
  assert.match(source, /← Back to Homepage/);
  assert.doesNotMatch(source, /ArticleEditorialClosing/);
});

test("editorial state symbol images scale from content width", () => {
  const width = 360;
  const imageWidth = stateAtAGlanceEditorialImageWidth(width);
  const imageHeight = stateAtAGlanceEditorialImageHeight(imageWidth);
  assert.equal(imageWidth, width);
  assert.ok(imageHeight > 0);
});

test("ArticleReader renders state glance after body paragraphs", () => {
  const source = readFileSync(
    path.join(__dirname, "../../components/ArticleReader.tsx"),
    "utf8"
  );
  const bodyIdx = source.indexOf("(article.body ?? []).map");
  const glanceIdx = source.indexOf("<StateAtAGlanceSection");
  const modulesIdx = source.indexOf("<ContentTemplateModules");
  assert.ok(bodyIdx >= 0);
  assert.ok(glanceIdx > bodyIdx);
  assert.ok(modulesIdx > glanceIdx);
});

test("Story of reader ending omits Why we remember and redundant navigation", () => {
  const articleSource = readFileSync(
    path.join(__dirname, "./article.ts"),
    "utf8"
  );
  assert.match(
    articleSource,
    /isStoryOfSection\(article\.section\)[\s\S]*modules: article\.modules\?\.length \? article\.modules : \[\]/
  );

  const readerSource = readFileSync(
    path.join(__dirname, "../../components/ArticleReader.tsx"),
    "utf8"
  );
  assert.match(
    readerSource,
    /!isCityHistorySection\(article\.section\)[\s\S]*ContentTemplateModules/
  );
  assert.doesNotMatch(readerSource, /Why we remember/);
  assert.doesNotMatch(readerSource, /Back to the morning paper/);
  assert.doesNotMatch(readerSource, /This page/);
  assert.doesNotMatch(readerSource, /closingCadence/);
  // Story of Your City and Today in History end with a single
  // "← Back to Homepage" action — no colophon or "Continue reading" block.
  assert.match(readerSource, /isSimpleHistoricalClose/);
  assert.match(readerSource, /styles\.historicalClose/);
  assert.match(readerSource, /← Back to Homepage/);
});
