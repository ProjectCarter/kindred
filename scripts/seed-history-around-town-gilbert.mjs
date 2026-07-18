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
      "Twenty thousand gallons of steel still tell drivers where downtown begins — in a town that measured itself in hay bales, not rooftops.",
    story_body: `Before Gilbert had traffic signals or strip malls, farmers needed water after dark. The tower went up in 1927 to hold 20,000 gallons — gravity-fed storage for a village still shipping enough alfalfa that neighbors called the surrounding country the Hay Capital of the World. It became the tallest thing for miles, visible from fields that have since become cul-de-sacs.

For decades the tank did unglamorous work. Dairies multiplied; cotton wagons crossed Gilbert Road; the structure marked the center of town the way a courthouse dome might elsewhere. When metropolitan Phoenix reached the East Valley in the 1980s and 1990s, farmland vanished almost overnight — yet the tank stayed, eventually restored and lit above the Heritage District.

Concerts, farmers markets, and restaurant patios now unfold within sight of its legs. Newcomers still use it to find downtown; older residents remember when Gilbert Road was a two-lane farm corridor. The tower cannot explain an entire century of Salt River Valley growth — but it answers one stubborn question: where does this place begin?`,
    history_summary:
      "Built in 1927 to store 20,000 gallons of water for Gilbert's farming community, the steel tower became the town's tallest landmark and remains a restored centerpiece of the Heritage District.",
    why_it_matters:
      "A quarter-million people now live where alfalfa once grew, yet civic life still orients around a structure built for hay fields. The tower makes abstract growth visible — one object that survived the shift from agricultural siding to Arizona suburb.",
    interesting_facts: [
      "Gilbert was once known as the Hay Capital of the World because of the volume of alfalfa shipped from local dairies.",
      "Night lighting was added during restoration, making the tower the most recognizable silhouette in downtown after dark.",
      "The tank held only 20,000 gallons — modest by modern standards, but essential when farms relied on gravity-fed storage rather than electric pumps.",
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
      "Drive past the tower at dusk and notice how many directions in town still begin with it — a farm utility from 1927 that became Gilbert's compass as the fields disappeared.",
    year_established: "1927",
    historical_metadata_line: "Built in 1927",
    historical_era: "Agricultural Heritage",
    timeline_entries: [
      {
        year: "1920",
        event: "Gilbert incorporates as a town — seven years before the tower would rise.",
      },
      {
        year: "1927",
        event: "Steel water tower erected to store 20,000 gallons for the farming community.",
      },
      {
        year: "1990s",
        event: "Suburban growth arrives; the tower is restored and illuminated above downtown.",
      },
    ],
    looking_closer: [
      "Riveted steel tank on a tapered support — typical of early twentieth-century municipal water storage.",
      "Night lighting makes the tower visible across the Heritage District after dark.",
      "From the sidewalk, compare the tower's farm-town scale to the restaurants and offices that now surround it.",
    ],
    visiting_today_text:
      "The tank is an exterior landmark along Heritage District sidewalks — not open for interior tours, but visible from patios, markets, and evening concerts that gather around its base.",
    before_you_go_text:
      "Summer afternoons on Gilbert Road can be hot and exposed; evening visits are cooler and show the tower lit. Weekend markets and concerts draw crowds — arrive early if you want quieter photos.",
    visit_duration_text: "10–15 minutes on foot",
    nearby_place_slugs: [
      "heritage-district",
      "gilbert-historical-museum",
      "liberty-market",
    ],
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
      "Inside a 1913 schoolhouse, desks and dairy tools preserve a farm town that outgrew its own memory.",
    story_body: `Gilbert Elementary School opened in 1913, when Arizona was still young and this village bet its future on Salt River Project water. Children learned reading and arithmetic in rooms that now hold photographs of cotton wagons, milking equipment, and the first businesses along Gilbert Road — the same road that now carries traffic to a city of a quarter-million.

The galleries reward attention, not spectacle. Exhibits follow Hohokam canal networks beneath modern subdivisions, the 1902 land sale that put Gilbert on railroad timetables, and the suburban decades that followed. Farm implements that look like sculpture to teenagers sit beside yearbooks from schools that no longer exist under the same names.

Gilbert's scale makes memory fragile. A family can enroll in excellent schools here and never hear that the town once measured its reputation in hay bales. These schoolhouse walls give that context a physical address — desks, tools, and documents that survived the crossing from agricultural crossroads to edge city.`,
    history_summary:
      "Housed in the 1913 Gilbert Elementary School building, the museum preserves photographs, farm tools, and classroom artifacts from Gilbert's agricultural decades.",
    why_it_matters:
      "Gilbert multiplied faster than almost any American town in the early 2000s. Without a dedicated interpretive site, that history disappears under strip malls and master-planned neighborhoods.",
    interesting_facts: [
      "The museum is operated by the Gilbert Historical Society — a nonprofit separate from town government.",
      "Exhibits include maps of Hohokam irrigation canals that predated Anglo settlement in the Salt River Valley.",
      "Yearbooks on display come from schools that no longer operate under the same names.",
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
      "Step back into the old classroom before you leave — nearly everything outside the window would have been farmland when these desks were new, and that distance is Gilbert's story in one glance.",
    year_established: "1913",
    historical_metadata_line: "Since 1913",
    phone: "(480) 926-1576",
    admission_url: "https://www.gilbertmuseum.org/visit",
    timeline_entries: [
      {
        year: "1913",
        event: "Gilbert Elementary School opens in a new building on Gilbert Road.",
      },
      {
        year: "1970s",
        event: "School use ends; community leaders begin preserving the building for local history.",
      },
      {
        year: "1980s",
        event: "Gilbert Historical Society establishes a museum in the former schoolhouse.",
      },
    ],
    looking_closer: [
      "Original classroom proportions and masonry survive inside the 1913 schoolhouse shell.",
      "Farm tools, dairy photographs, and classroom desks sit side by side — the town's two economies in one room.",
      "Exhibits trace Hohokam canal networks beneath modern suburban streets.",
    ],
    visiting_today_text:
      "Gallery rooms hold photographs, farm implements, and school artifacts year-round, with seasonal exhibits and talks rotating through the nonprofit museum operated by the Gilbert Historical Society.",
    before_you_go_text:
      "Confirm current hours and admission at gilbertmuseum.org before visiting — schedules can change seasonally. Weekday mornings are usually quietest.",
    visit_duration_text: "45–90 minutes",
    nearby_place_slugs: [
      "gilbert-water-tower",
      "heritage-district",
      "gilberts-first-jail",
    ],
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
      "Gilbert Road still reads like a main street — brick storefronts, patio lights, and a water tower watching over a suburb that almost forgot it had a downtown.",
    story_body: `Most of Gilbert was drawn for cars — wide arterials, parking lots, master-planned grids. The Heritage District is the exception: a walkable strip along Gilbert Road where low commercial buildings from the early and mid twentieth century survived the annexation waves. Neon and patio heaters sit beside brick facades; the human scale feels borrowed from an older kind of town.

In the agricultural decades, this was service country for farmers — hardware, groceries, fuel, and the errands that followed church and school. Railroad sidings and hay warehouses sat within wagon distance. When population charts turned vertical, planners chose to invest here rather than surrender downtown to bypass roads — streetscape work, events, zoning that favored mixed use.

Gilbert annexed farmland aggressively and welcomed regional employers, yet concerts, markets, and evening dining still cluster within sight of the 1927 tower. The district is where the city practices continuity — living near its own history instead of driving past it on the way somewhere else.`,
    history_summary:
      "Gilbert's downtown core along Gilbert Road, centered on early twentieth-century commercial buildings and anchored by the 1927 water tower.",
    why_it_matters:
      "Fast-growing suburbs often erase their main streets. Gilbert kept one — and invested in it — giving newcomers a walkable reference point for civic life.",
    interesting_facts: [
      "Farmers markets and concerts on Gilbert Road draw visitors from across the East Valley on many weekends.",
      "Several storefronts still date to the decades when Gilbert shipped hay rather than housing starts.",
      "Town streetscape improvements in the 2000s deliberately favored mixed use along this corridor.",
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
      "Walk Gilbert Road once at noon and once after the tower lights switch on — the same brick reads as archive in daylight and as neighborhood in the evening, and that double life is how this city chose to grow.",
    year_established: "1920",
    historical_metadata_line: "From the 1920s",
    historical_era: "Agricultural Heritage",
    historic_designation: "Heritage District",
    historic_designations: ["Historic District"],
    timeline_entries: [
      {
        year: "1902",
        event: "Land sale and railroad siding put Gilbert on regional shipping maps.",
      },
      {
        year: "1920",
        event: "Gilbert incorporates; Gilbert Road storefronts serve a farming community.",
      },
      {
        year: "1927",
        event: "Water tower rises at the district's heart — still its tallest landmark.",
      },
      {
        year: "2000s",
        event: "Streetscape investment and events programming revive downtown as a walkable core.",
      },
    ],
    looking_closer: [
      "Low-slung brick and masonry storefronts from the early and mid twentieth century line Gilbert Road.",
      "The restored 1927 water tower remains visible from nearly every block.",
      "Neon, patios, and market tents sit beside facades that once sold hardware and feed.",
    ],
    visiting_today_text:
      "Shops, restaurants, offices, and public events share the same walkable strip. Farmers markets, concerts, and evening dining bring the sidewalks to life most weekends.",
    before_you_go_text:
      "Event nights fill parking quickly — consider arriving before sunset or using rideshare drop-off on Gilbert Road. Summer evenings are busy but cooler than midday.",
    visit_duration_text: "1–2 hours on foot",
    dog_policy_text: "Outdoor patios may welcome dogs; confirm with individual businesses.",
    nearby_place_slugs: [
      "gilbert-water-tower",
      "gilbert-historical-museum",
      "bank-of-gilbert",
      "liberty-market",
    ],
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
      "Hay-sale deposits once required a vault on Gilbert Road — brick and storefront windows from an economy measured in alfalfa contracts.",
    story_body: `The Bank of Gilbert building rose in 1917, when prosperity here still meant alfalfa contracts and dairy shipments rather than master-planned rooftops. Farmers who sold hay through Gilbert's sidings needed somewhere local to hold proceeds between seasons; a brick bank on the main road signaled that the community intended to stay put.

The architecture is modest — two stories, commercial scale, ground-floor windows — but it anchored confidence in a village that had incorporated only a few years earlier. In agricultural towns, banks doubled as bulletin boards: tellers recognized every signature, and news traveled at the counter.

The branch is long gone, yet the facade survives among Heritage District storefronts, still legible as early twentieth-century Gilbert. From the sidewalk you can read an economy in brick — crop money becoming town money before anyone imagined a quarter-million neighbors.`,
    history_summary:
      "Built in 1917 on Gilbert Road, the Bank of Gilbert building served the town's agricultural economy and remains a preserved commercial facade in the Heritage District.",
    why_it_matters:
      "Before Gilbert became a Phoenix suburb, local banks held the proceeds of hay and dairy sales. The building makes that economy visible in brick rather than statistics.",
    interesting_facts: [
      "Gilbert incorporated as a town in 1920 — three years after the bank building opened.",
      "Agricultural banks in towns this size often served as informal meeting places as much as vaults.",
      "The facade remains commercial space, part of the same streetscape as the 1927 water tower one block south.",
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
      "Read the window lines as a ledger — crop money became town money on this corner long before Gilbert needed a single traffic signal.",
    year_established: "1917",
    historical_metadata_line: "Built in 1917",
    timeline_entries: [],
    looking_closer: [
      "Two-story commercial brick with storefront windows typical of main-street banking.",
      "The facade survives within sight of the 1927 water tower.",
      "Ground-floor window rhythm still reads as early twentieth-century Gilbert Road.",
    ],
    visiting_today_text:
      "Commercial tenants occupy the interior; the preserved facade is best read from the Gilbert Road sidewalk as part of a Heritage District architecture walk.",
    before_you_go_text:
      "Interior access depends on current tenants — this is primarily an exterior architecture stop. Pair it with the water tower one block away.",
    visit_duration_text: "5–10 minutes",
    nearby_place_slugs: [
      "gilbert-water-tower",
      "heritage-district",
      "gilbert-historical-museum",
    ],
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
      "Gilbert's first jail fits in a single room — a 1918 reminder that law enforcement here once meant irrigation disputes, not freeways.",
    story_body: `In 1918, Gilbert's troubles still fit inside one small building: stray livestock, canal arguments, an occasional rowdy Saturday. The jail is tiny by any modern measure — a single structure that held local law enforcement before Maricopa County growth demanded larger facilities and professional departments.

Civic buildings in farm towns were often improvised and later demolished. A jail from 1918 carries no glamour, but it marks the moment Gilbert needed formal institutions beyond the schoolhouse and the bank. It belongs in the Heritage District conversation alongside the water tower and storefronts — evidence that order-keeping arrived with permanent downtown architecture.

Restored restaurants and lit towers draw the crowds. The jail is easy to miss, which is exactly why it earns a place in this collection: it remembers the ordinary machinery of town life before population graphs turned vertical.`,
    history_summary:
      "Built in 1918, Gilbert's first jail house provided local law enforcement in the Heritage District during the town's early agricultural decades.",
    why_it_matters:
      "Civic history is not only schools and churches — it includes the small buildings that made daily order possible in a farm town.",
    interesting_facts: [
      "St. Anne's Catholic parish formed in Gilbert the same year the jail was built — 1918.",
      "The building is among several early twentieth-century civic structures still standing in the Heritage District.",
      "Maricopa County's later growth eventually outgrew facilities this small for modern law enforcement.",
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
      "Measure the jail's footprint against a modern patrol car — the distance between that gap and a quarter-million residents is Gilbert's civic story told without a single statistic.",
    year_established: "1918",
    historical_metadata_line: "Built in 1918",
    timeline_entries: [],
    looking_closer: [
      "Small-scale municipal detention architecture from the 1910s — modest even by the standards of its own era.",
      "Survives near other early civic structures in the Heritage District.",
    ],
    visiting_today_text:
      "Best appreciated on a Heritage District walking route alongside the water tower, museum, and early storefronts. Interior access varies — confirm with local historical resources.",
    before_you_go_text:
      "Treat this as an exterior heritage stop unless a guided tour or event provides interior access.",
    visit_duration_text: "5–10 minutes",
    nearby_place_slugs: [
      "gilbert-water-tower",
      "heritage-district",
      "bank-of-gilbert",
    ],
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
      "Flour and canned goods once sold here; now breakfast orders echo under the same 1930s roof — a grocery that never left the neighborhood.",
    story_body: `Long before "food hall" entered suburban vocabulary, Liberty Market fed Gilbert as a neighborhood grocery. Built in the 1930s, it served farm families who bought provisions where they already came for mail, news, and conversation — brick and signage promising permanence in a landscape still mostly fields.

Adaptive reuse is ordinary in Western cities. What distinguishes this building is visibility: it sits in the Heritage District within blocks of the water tower and museum, so diners encounter history whether or not they planned to. The interior keeps enough of its commercial bones that the space reads as renovation, not costume.

Gilbert's growth story is often told in acres annexed and rooftops added. Liberty Market tells it at counter height — flour and canned goods giving way to espresso and brunch in the same community, under the same roof.`,
    history_summary:
      "Built in the 1930s as a local grocery, the Liberty Market building now operates as a restaurant while retaining its Heritage District storefront character.",
    why_it_matters:
      "Adaptive reuse keeps everyday history legible. A working restaurant in a 1930s market is more memorable than a plaque alone.",
    interesting_facts: [
      "The building operated as a grocery before its restaurant conversion in the 2000s.",
      "Page Avenue drop-off and Heritage District parking serve the restaurant today.",
      "Interior details reference the market past — a renovation choice, not a themed facade.",
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
      "Order at the counter and look up — the bones of a 1930s grocery still frame the same corner where neighbors once bought flour, and that continuity is rarer in Gilbert than any plaque suggests.",
    year_established: "1936",
    historical_metadata_line: "From the 1930s",
    phone: "(480) 557-0798",
    admission_url: "https://libertymarket.com/",
    timeline_entries: [
      {
        year: "1936",
        event: "Liberty Market opens as a neighborhood grocery on Page Avenue.",
      },
      {
        year: "2000s",
        event: "Building adaptively reused as a restaurant while retaining its storefront character.",
      },
    ],
    looking_closer: [
      "1930s commercial brick storefront adapted for restaurant use.",
      "Interior details reference the building's grocery past without erasing its bones.",
      "Sits within blocks of the water tower and Gilbert Road's historic strip.",
    ],
    visiting_today_text:
      "Liberty Market runs as a working restaurant in the restored grocery — breakfast, lunch, and weekend brunch draw locals and visitors to the Heritage District.",
    before_you_go_text:
      "Weekend brunch queues are common; weekday breakfast is quieter. Check libertymarket.com for current hours before you go.",
    visit_duration_text: "1–2 hours with a meal",
    nearby_place_slugs: [
      "heritage-district",
      "gilbert-water-tower",
      "gilbert-historical-museum",
    ],
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
    phone: place.phone ?? null,
    year_established: place.year_established ?? null,
    historical_era: place.historical_era ?? null,
    historical_metadata_line: place.historical_metadata_line ?? null,
    historic_designation: place.historic_designation ?? null,
    historic_designations: place.historic_designations ?? [],
    historical_significance: place.historical_significance ?? null,
    editorial_introduction: place.editorial_introduction ?? null,
    looking_closer: place.looking_closer ?? [],
    timeline_entries: place.timeline_entries ?? [],
    visiting_today_text: place.visiting_today_text ?? null,
    before_you_go_text: place.before_you_go_text ?? null,
    visit_duration_text: place.visit_duration_text ?? null,
    dog_policy_text: place.dog_policy_text ?? null,
    google_maps_url: place.google_maps_url ?? null,
    admission_url: place.admission_url ?? null,
    nearby_place_slugs: place.nearby_place_slugs ?? [],
    approval_status: "approved",
    editorial_priority: place.editorial_priority,
    featured: place.featured ?? false,
    last_reviewed_at: now,
    verified_at: now,
    verified_by: "seed-history-around-town-gilbert-v11-editorial",
    verification_notes:
      "v1.1 editorial polish — cross-checked against Town of Gilbert history pages, gilbertmuseum.org, and Wikimedia Commons image provenance.",
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
