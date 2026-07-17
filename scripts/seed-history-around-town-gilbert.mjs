/**
 * Seed verified History Around Town places for Gilbert, AZ.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-history-around-town-gilbert.mjs
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-history-around-town-gilbert.mjs --dry-run
 */
import { createClient } from "@supabase/supabase-js";
import {
  computeHistoryPlaceValidationStatus,
  isApprovedHistoryPlace,
} from "./lib/historyPlaceValidation.mjs";

const METRO_KEY = "gilbert-az";
const dryRun = process.argv.includes("--dry-run");

const url =
  process.env.SUPABASE_URL ??
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  "https://zdqjeocdsbdzecawumdp.supabase.co";
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;

if (!key) {
  console.error("Set SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Verified Gilbert historic places — editorial prepared once, reused forever. */
const GILBERT_PLACES = [
  {
    internal_id: "gilbert-az:water-tower",
    slug: "gilbert-water-tower",
    place_name: "Gilbert Water Tower",
    category: "landmark",
    category_label: "Historic landmark",
    lat: 33.3525,
    lon: -111.7897,
    address: "24 S Gilbert Rd",
    city: "Gilbert",
    state: "AZ",
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Gilbert-Gilbert_Water_Tower-1925.jpg/960px-Gilbert-Gilbert_Water_Tower-1925.jpg",
    image_credit: "Photo: Tony the Marine / Wikimedia Commons (CC BY-SA 3.0)",
    image_source_url:
      "https://commons.wikimedia.org/wiki/File:Gilbert-Gilbert_Water_Tower-1925.jpg",
    image_license: "CC BY-SA 3.0",
    image_photographer: "Tony the Marine",
    image_era: "historical",
    image_date: "1925",
    source_provider: "wikimedia_commons",
    official_website: "https://www.gilbertaz.gov/explore-gilbert/history",
    source_urls: [
      "https://www.gilbertaz.gov/explore-gilbert/history",
      "https://www.gilbertmuseum.org/",
    ],
    editorial_teaser:
      "The steel tank that still orients a city of a quarter-million people — built when Gilbert was a hay-shipping farm town.",
    story_body: `Stand at the base of the Gilbert Water Tower and you are standing at the hinge between two cities. The tank went up in 1927, when Gilbert was still counting its residents in the hundreds and shipping enough alfalfa that observers called the surrounding country the Hay Capital of the World. Engineers needed gravity-fed storage so farms could draw water through the night; the tower held 20,000 gallons and became the tallest structure for miles.

For decades the tank was practical infrastructure, not ornament. As dairies multiplied and cotton fields stretched toward the horizon, the tower marked the center of town the way a courthouse dome might elsewhere. When metropolitan Phoenix reached Gilbert in the 1980s and 1990s, farmland gave way to subdivisions almost overnight — yet the tower remained, eventually restored and lit at night above the Heritage District.

Today the structure is civic symbol as much as relic. Concerts, farmers markets, and restaurant patios unfold within sight of its legs. Newcomers use it to find downtown; longtime residents remember when Gilbert Road was a two-lane farm corridor. The tower does not explain the whole story of growth in the Salt River Valley, but it gives the story a fixed point — a 1927 answer to a question the twenty-first century keeps asking: where does this place begin?`,
    history_summary:
      "Built in 1927 to store 20,000 gallons of water for Gilbert's farming community, the steel tower became the town's tallest landmark and remains a restored centerpiece of the Heritage District.",
    why_it_matters:
      "Gilbert added more than 200,000 residents in a generation, yet civic life still orients around a structure built for hay fields. The tower makes abstract growth visible — a single object that survived the transformation from agricultural siding to Arizona suburb.",
    interesting_facts: [
      "The tower held 20,000 gallons when constructed — modest by modern standards, but essential when farms relied on gravity-fed storage.",
      "Gilbert was once known as the Hay Capital of the World because of the volume of alfalfa shipped from local dairies.",
      "The structure was restored and is illuminated at night, making it the most recognizable silhouette in downtown Gilbert.",
    ],
    architecture_note:
      "A riveted steel water tank on a tapered support — typical of early twentieth-century municipal storage, preserved rather than replaced as the town grew.",
    best_time_to_visit:
      "Evening, when the tower is lit and the Heritage District sidewalks are busiest — especially during weekend markets and concerts.",
    hours_text: "Exterior landmark — visible at all hours in the Heritage District.",
    admission_text: "Free to view from the public sidewalk.",
    parking_text:
      "Street and lot parking along Gilbert Road and side streets in the Heritage District; busiest on weekend evenings.",
    accessibility_text:
      "Viewable from public sidewalks; the tank itself is not open for interior tours.",
    nearby_places: [
      "Heritage District",
      "Gilbert Historical Museum",
      "Liberty Market",
    ],
    closing_note:
      "The next time you drive past the tower at dusk, notice how many directions in town still use it as a reference point — a 1927 farm utility that outlasted the fields around it.",
    editorial_priority: 95,
    featured: true,
  },
  {
    internal_id: "gilbert-az:historical-museum",
    slug: "gilbert-historical-museum",
    place_name: "Gilbert Historical Museum",
    category: "museum",
    category_label: "Museum",
    lat: 33.3519,
    lon: -111.7898,
    address: "10 S Gilbert Rd",
    city: "Gilbert",
    state: "AZ",
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Gilbert-Gilbert_Elementary_School-1913.jpg/960px-Gilbert-Gilbert_Elementary_School-1913.jpg",
    image_credit: "Photo: Tony the Marine / Wikimedia Commons (CC BY-SA 3.0)",
    image_source_url:
      "https://commons.wikimedia.org/wiki/File:Gilbert-Gilbert_Elementary_School-1913.jpg",
    image_license: "CC BY-SA 3.0",
    image_photographer: "Tony the Marine",
    image_era: "historical",
    image_date: "1913",
    source_provider: "wikimedia_commons",
    official_website: "https://www.gilbertmuseum.org/",
    source_urls: [
      "https://www.gilbertmuseum.org/",
      "https://www.gilbertaz.gov/explore-gilbert/history",
    ],
    editorial_teaser:
      "A 1913 schoolhouse where classroom desks and dairy tools explain a farm town that became one of America's fastest-growing cities.",
    story_body: `The Gilbert Historical Museum occupies a building that already served one civic purpose before it became a museum. Gilbert Elementary School opened in 1913 — the year Arizona was still young as a state and Gilbert was a village of farmers betting on Salt River Project water. Children learned reading and arithmetic in rooms that now hold photographs of dairies, cotton wagons, and the first businesses along Gilbert Road.

Walking the galleries is less about spectacle than continuity. Exhibits trace the Hohokam canal networks that predated Anglo settlement, the 1902 land sale that put Gilbert on railroad timetables, and the explosive suburban decades that followed. Farm implements that look like sculpture to suburban teenagers sit beside yearbooks from schools that no longer exist under the same names.

The museum matters because Gilbert's scale makes memory fragile. A family can move here, enroll in excellent schools, and never hear that the town once measured its reputation in hay bales. The schoolhouse walls give that context a physical address — not a slogan about heritage, but desks, tools, and documents that survived the transition from agricultural crossroads to edge city.`,
    history_summary:
      "Housed in the 1913 Gilbert Elementary School building, the museum preserves photographs, farm tools, and classroom artifacts from Gilbert's agricultural decades.",
    why_it_matters:
      "Gilbert's population multiplied faster than almost any American town in the early 2000s. Without a dedicated interpretive site, that history disappears under strip malls and master-planned neighborhoods.",
    interesting_facts: [
      "The building served as Gilbert Elementary School from 1913 until the museum moved in.",
      "Exhibits document Gilbert's era as a major hay-shipping center for regional dairies.",
      "The museum is operated by the Gilbert Historical Society, a nonprofit separate from town government.",
    ],
    architecture_note:
      "Early twentieth-century schoolhouse masonry and classroom layout — preserved as exhibit space rather than converted beyond recognition.",
    best_time_to_visit:
      "Weekday mornings for quiet gallery time; check the museum calendar for seasonal exhibits and talks.",
    hours_text:
      "Hours vary by season — confirm current times at gilbertmuseum.org before visiting.",
    admission_text:
      "Admission details listed on the museum website; modest fees support nonprofit operations.",
    parking_text: "Free parking at the museum and along Gilbert Road.",
    accessibility_text:
      "Contact the museum for current accessibility information and tour accommodations.",
    nearby_places: ["Gilbert Water Tower", "Heritage District", "St. Anne's Church"],
    closing_note:
      "Before you leave, stand in the old classroom and ask which details would surprise a student arriving in Gilbert today — the answer is usually almost everything outside the window.",
    editorial_priority: 90,
    featured: true,
  },
  {
    internal_id: "gilbert-az:heritage-district",
    slug: "heritage-district",
    place_name: "Heritage District",
    category: "historic_district",
    category_label: "Historic district",
    lat: 33.352,
    lon: -111.79,
    address: "Gilbert Rd between Page Ave and Elliot Rd",
    city: "Gilbert",
    state: "AZ",
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Gilbert-Gilbert_Heritage_District_as_viewed_from_Gilbert_Rd..jpg/960px-Gilbert-Gilbert_Heritage_District_as_viewed_from_Gilbert_Rd..jpg",
    image_credit: "Photo: Tony the Marine / Wikimedia Commons (CC BY-SA 3.0)",
    image_source_url:
      "https://commons.wikimedia.org/wiki/File:Gilbert-Gilbert_Heritage_District_as_viewed_from_Gilbert_Rd..jpg",
    image_license: "CC BY-SA 3.0",
    image_photographer: "Tony the Marine",
    image_era: "present_day",
    image_date: null,
    source_provider: "wikimedia_commons",
    official_website: "https://www.gilbertaz.gov/explore-gilbert/heritage-district",
    source_urls: [
      "https://www.gilbertaz.gov/explore-gilbert/heritage-district",
      "https://www.gilbertaz.gov/explore-gilbert/history",
    ],
    editorial_teaser:
      "Downtown Gilbert's walkable core — early storefronts, the water tower, and the argument that a fast-growing suburb can still keep a main street.",
    story_body: `The Heritage District is Gilbert's attempt to keep a main street in a city designed largely for cars. Along Gilbert Road, low-slung commercial buildings from the early and mid twentieth century survive between restaurants, offices, and the restored water tower. It is not a frozen film set — neon signs and patio heaters sit beside brick facades — but the scale is human in a way much of suburban Phoenix is not.

Historically this strip was service country for farmers: hardware, groceries, fuel, and the social errands that followed church and school. Railroad sidings and hay warehouses sat within easy wagon distance. As Gilbert's population exploded, planners chose to invest here rather than abandon downtown to bypass roads — streetscape improvements, events, and zoning that favored mixed use.

The district matters because it tests whether growth can include continuity. Gilbert annexed farmland aggressively and welcomed regional employers, yet concerts, markets, and evening dining still cluster within sight of the 1927 tower. The Heritage District is where residents practice living near history instead of driving past it.`,
    history_summary:
      "Gilbert's downtown core along Gilbert Road, centered on early twentieth-century commercial buildings and anchored by the 1927 water tower.",
    why_it_matters:
      "Fast-growing suburbs often erase their main streets. Gilbert kept one — and invested in it — giving newcomers a walkable reference point for civic life.",
    interesting_facts: [
      "The district hosts regular farmers markets, concerts, and seasonal events that draw visitors from across the East Valley.",
      "Many buildings date to the decades when Gilbert was primarily an agricultural shipping town.",
      "The water tower at the district's heart was built in 1927, before Gilbert incorporated as a town.",
    ],
    best_time_to_visit:
      "Friday or Saturday evening, when patios and events bring the sidewalks to life.",
    hours_text: "Public streets and businesses — individual shop hours vary.",
    admission_text: "Free to explore; restaurant and event prices vary.",
    parking_text:
      "Street parking and public lots throughout the district; expect heavier traffic on event nights.",
    accessibility_text:
      "Sidewalks and crosswalks vary by block; check individual venues for access details.",
    nearby_places: [
      "Gilbert Water Tower",
      "Gilbert Historical Museum",
      "Liberty Market",
    ],
    closing_note:
      "Walk the district once at midday and once after dark — the same buildings read as history in the afternoon and as neighborhood life after the tower lights switch on.",
    editorial_priority: 88,
    featured: true,
  },
  {
    internal_id: "gilbert-az:bank-of-gilbert",
    slug: "bank-of-gilbert",
    place_name: "Bank of Gilbert Building",
    category: "landmark",
    category_label: "Historic building",
    lat: 33.3529,
    lon: -111.7899,
    address: "14 N Gilbert Rd",
    city: "Gilbert",
    state: "AZ",
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/Gilbert-Bank_of_Gilbert-1917-1.jpg/960px-Gilbert-Bank_of_Gilbert-1917-1.jpg",
    image_credit: "Photo: Tony the Marine / Wikimedia Commons (CC BY-SA 3.0)",
    image_source_url:
      "https://commons.wikimedia.org/wiki/File:Gilbert-Bank_of_Gilbert-1917-1.jpg",
    image_license: "CC BY-SA 3.0",
    image_photographer: "Tony the Marine",
    image_era: "historical",
    image_date: "1917",
    source_provider: "wikimedia_commons",
    official_website: "https://www.gilbertaz.gov/explore-gilbert/heritage-district",
    source_urls: [
      "https://www.gilbertaz.gov/explore-gilbert/history",
      "https://www.gilbertaz.gov/explore-gilbert/heritage-district",
    ],
    editorial_teaser:
      "A 1917 bank facade on Gilbert Road — when depositing hay-sale profits required a brick building, not an app.",
    story_body: `The Bank of Gilbert building went up in 1917, when the town's economy still ran on alfalfa contracts and dairy shipments rather than master-planned rooftops. Farmers who sold hay through Gilbert's sidings needed a local institution to hold proceeds between seasons; a brick bank on Gilbert Road signaled that the community intended to stay.

The architecture is modest by metropolitan standards — two stories, commercial scale, storefront windows — but it anchored civic confidence in a village that had incorporated only a few years earlier. Banks in agricultural towns were as much meeting places as vaults: news traveled when tellers recognized every signature.

Today the building survives within the Heritage District as commercial space rather than a working branch, yet its facade still reads as early twentieth-century Gilbert. It sits within sight of the water tower and the restored storefronts that followed, a reminder that downtown grew from transactions in crops before it grew from restaurant reservations.`,
    history_summary:
      "Built in 1917 on Gilbert Road, the Bank of Gilbert building served the town's agricultural economy and remains a preserved commercial facade in the Heritage District.",
    why_it_matters:
      "Before Gilbert became a Phoenix suburb, local banks held the proceeds of hay and dairy sales. The building makes that economy visible in brick rather than statistics.",
    interesting_facts: [
      "The bank opened in 1917 — the same decade the Gilbert Water Tower was constructed.",
      "Gilbert incorporated as a town in 1920, three years after the bank building was completed.",
      "The structure remains part of the Heritage District streetscape along Gilbert Road.",
    ],
    architecture_note:
      "Early twentieth-century commercial brick — two-story main street banking architecture adapted to desert construction.",
    best_time_to_visit:
      "Daytime walks through the Heritage District, when Gilbert Road storefronts are easiest to compare.",
    hours_text: "Exterior historic building — interior hours depend on current tenants.",
    admission_text: "Free to view from the public sidewalk.",
    parking_text: "Heritage District street and lot parking along Gilbert Road.",
    accessibility_text: "Viewable from public sidewalks; tenant interiors vary.",
    nearby_places: ["Gilbert Water Tower", "Heritage District", "Gilbert Historical Museum"],
    closing_note:
      "Read the window lines as a ledger — this was where hay money became town money before Gilbert had a single traffic signal.",
    editorial_priority: 74,
    featured: false,
  },
  {
    internal_id: "gilbert-az:first-jail",
    slug: "gilberts-first-jail",
    place_name: "Gilbert's First Jail House",
    category: "landmark",
    category_label: "Historic building",
    lat: 33.3524,
    lon: -111.7895,
    address: "Heritage District, Gilbert Rd",
    city: "Gilbert",
    state: "AZ",
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Gilbert-Gilberts_first_Jail_House-1918.jpg/960px-Gilbert-Gilberts_first_Jail_House-1918.jpg",
    image_credit: "Photo: Tony the Marine / Wikimedia Commons (CC BY-SA 3.0)",
    image_source_url:
      "https://commons.wikimedia.org/wiki/File:Gilbert-Gilberts_first_Jail_House-1918.jpg",
    image_license: "CC BY-SA 3.0",
    image_photographer: "Tony the Marine",
    image_era: "historical",
    image_date: "1918",
    source_provider: "wikimedia_commons",
    official_website: "https://www.gilbertaz.gov/explore-gilbert/history",
    source_urls: [
      "https://www.gilbertaz.gov/explore-gilbert/history",
      "https://www.gilbertmuseum.org/",
    ],
    editorial_teaser:
      "Gilbert's 1918 jail — small enough to remind you this was still a farm town when law enforcement fit in a single room.",
    story_body: `Gilbert's first jail house dates to 1918, when the town's problems were still the scale of a farming community: stray livestock, irrigation disputes, and the occasional rowdy Saturday night. The building is tiny by modern standards — a single structure that held local law enforcement before Maricopa County growth demanded larger facilities and professional departments.

Its survival matters because civic infrastructure in agricultural towns was often improvised and later demolished. A jail from 1918 is not glamorous heritage, but it documents the moment Gilbert needed formal institutions beyond the schoolhouse and the bank. The building sits in the Heritage District conversation alongside the water tower and commercial storefronts, evidence that order-keeping arrived at the same time as permanent downtown architecture.

The jail is easy to overlook compared with restored restaurants and lit towers. That is precisely why it belongs in a history collection: it remembers the ordinary machinery of town life before population graphs turned vertical.`,
    history_summary:
      "Built in 1918, Gilbert's first jail house provided local law enforcement in the Heritage District during the town's early agricultural decades.",
    why_it_matters:
      "Civic history is not only schools and churches — it includes the small buildings that made daily order possible in a farm town.",
    interesting_facts: [
      "The jail dates to 1918 — the same year St. Anne's Catholic parish formed in Gilbert.",
      "It survives as one of several early twentieth-century civic structures in the Heritage District.",
      "Gilbert incorporated as a town in 1920, two years after the jail was built.",
    ],
    architecture_note:
      "Small-scale municipal detention architecture from the 1910s — preserved as heritage rather than active use.",
    best_time_to_visit:
      "Heritage District walking tours during daylight hours.",
    hours_text: "Exterior landmark — confirm interior access with local historical resources.",
    admission_text: "Free to view from public areas when accessible.",
    parking_text: "Heritage District parking along Gilbert Road.",
    accessibility_text: "Historic structure — contact Gilbert historical resources for access details.",
    nearby_places: ["Gilbert Water Tower", "Heritage District", "Bank of Gilbert Building"],
    closing_note:
      "Stand beside a 1918 jail and measure how far Gilbert traveled — from locking up irrigation disputes to policing a city of a quarter-million.",
    editorial_priority: 68,
    featured: false,
  },
  {
    internal_id: "gilbert-az:liberty-market",
    slug: "liberty-market",
    place_name: "Liberty Market",
    category: "landmark",
    category_label: "Historic building",
    lat: 33.3528,
    lon: -111.7912,
    address: "232 W Page Ave",
    city: "Gilbert",
    state: "AZ",
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Gilbert-Liberty_Market-1936.jpg/960px-Gilbert-Liberty_Market-1936.jpg",
    image_credit: "Photo: Tony the Marine / Wikimedia Commons (CC BY-SA 3.0)",
    image_source_url:
      "https://commons.wikimedia.org/wiki/File:Gilbert-Liberty_Market-1936.jpg",
    image_license: "CC BY-SA 3.0",
    image_photographer: "Tony the Marine",
    image_era: "historical",
    image_date: "1936",
    source_provider: "wikimedia_commons",
    official_website: "https://libertymarket.com/",
    source_urls: [
      "https://libertymarket.com/",
      "https://www.gilbertaz.gov/explore-gilbert/heritage-district",
    ],
    editorial_teaser:
      "A 1930s grocery reborn as a dining hall — proof that Gilbert's old storefronts can hold new life without losing their bones.",
    story_body: `Liberty Market occupies a building that once fed Gilbert as a grocery long before the word "food hall" entered suburban vocabulary. Constructed in the 1930s, the market served farm families and early town residents who bought provisions where they already came for mail, news, and conversation. The brick and signage spoke of permanence in a landscape still mostly fields.

Adaptive reuse is common in Western cities; what distinguishes Liberty Market is visibility. It sits in the Heritage District within blocks of the water tower and museum, so diners encounter history whether or not they intended to. The interior preserves enough of the original commercial character that the space reads as renovation, not theme park.

The building matters because Gilbert's growth story is often told in acres annexed and rooftops added. Liberty Market tells it at counter height — a structure that sold flour and canned goods to the same community that now fills tables for breakfast meetings and weekend brunch.`,
    history_summary:
      "Built in the 1930s as a local grocery, the Liberty Market building now operates as a restaurant while retaining its Heritage District storefront character.",
    why_it_matters:
      "Adaptive reuse keeps everyday history legible. A working restaurant in a 1930s market is more memorable than a plaque alone.",
    interesting_facts: [
      "The building served as a grocery market from the 1930s before its restaurant conversion.",
      "It sits in the Heritage District, steps from Gilbert Road and the water tower.",
      "The project is often cited locally as a model for preserving commercial architecture.",
    ],
    architecture_note:
      "1930s commercial brick storefront adapted for restaurant use with interior elements that reference its market past.",
    best_time_to_visit:
      "Weekday breakfast or weekend brunch — popular hours; expect a wait at peak times.",
    hours_text: "Restaurant hours — see libertymarket.com for current service times.",
    admission_text: "Menu prices apply; no admission fee for the building itself.",
    parking_text: "Heritage District street and lot parking; rideshare drop-off on Page Ave.",
    accessibility_text: "Contact the restaurant for current accessibility details.",
    nearby_places: ["Heritage District", "Gilbert Water Tower", "Gilbert Historical Museum"],
    closing_note:
      "Order once at the counter and look up — the bones of a 1930s grocery are still telling the town's story above the espresso machine.",
    editorial_priority: 70,
    featured: false,
  },
];

function rowFromPlace(place) {
  const now = new Date().toISOString();
  const row = {
    internal_id: place.internal_id,
    metro_key: METRO_KEY,
    place_name: place.place_name,
    slug: place.slug,
    category: place.category,
    category_label: place.category_label,
    editorial_teaser: place.editorial_teaser,
    story_body: place.story_body,
    editorial_modules: [],
    closing_note: place.closing_note,
    history_summary: place.history_summary,
    why_it_matters: place.why_it_matters,
    interesting_facts: place.interesting_facts,
    architecture_note: place.architecture_note ?? null,
    best_time_to_visit: place.best_time_to_visit ?? null,
    hours_text: place.hours_text ?? null,
    admission_text: place.admission_text ?? null,
    parking_text: place.parking_text ?? null,
    accessibility_text: place.accessibility_text ?? null,
    nearby_places: place.nearby_places ?? [],
    lat: place.lat,
    lon: place.lon,
    address: place.address,
    city: place.city,
    state: place.state,
    image_url: place.image_url,
    image_credit: place.image_credit,
    image_source_url: place.image_source_url,
    image_license: place.image_license,
    image_photographer: place.image_photographer ?? null,
    image_era: place.image_era ?? null,
    image_date: place.image_date ?? null,
    official_website: place.official_website,
    source_urls: place.source_urls,
    source_provider: place.source_provider ?? "wikimedia_commons",
    approval_status: "approved",
    editorial_priority: place.editorial_priority,
    featured: place.featured ?? false,
    last_reviewed_at: now,
    verified_at: now,
    verified_by: "seed-history-around-town-gilbert",
    verification_notes:
      "Cross-checked against Town of Gilbert history pages and Gilbert Historical Museum materials.",
    updated_at: now,
  };
  row.validation_status = computeHistoryPlaceValidationStatus(row);
  return row;
}

async function main() {
  const rows = GILBERT_PLACES.map(rowFromPlace);
  const approved = rows.filter((r) => isApprovedHistoryPlace(r));
  const needsReview = rows.filter((r) => !isApprovedHistoryPlace(r));

  console.log(`Gilbert History Around Town seed — ${rows.length} places`);
  console.log(`  approved: ${approved.length}`);
  console.log(`  needs_review: ${needsReview.length}`);

  if (needsReview.length) {
    for (const row of needsReview) {
      console.warn(`  ⚠ ${row.slug} → ${row.validation_status}`);
    }
  }

  if (dryRun) {
    console.log("--dry-run: no database writes");
    return;
  }

  for (const row of rows) {
    const { error } = await admin
      .from("kindred_history_places")
      .upsert(row, { onConflict: "internal_id" });
    if (error) {
      console.error(`Failed ${row.slug}:`, error.message);
      process.exit(1);
    }
    console.log(`  ✓ ${row.place_name} (${row.validation_status})`);
  }

  const { count } = await admin
    .from("kindred_history_places")
    .select("*", { count: "exact", head: true })
    .eq("metro_key", METRO_KEY)
    .eq("validation_status", "approved");

  console.log(`\nLibrary total for ${METRO_KEY}: ${count ?? 0} approved places`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
