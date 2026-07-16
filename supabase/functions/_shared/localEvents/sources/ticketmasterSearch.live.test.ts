import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  fetchTicketmasterSearchCandidates,
  isTicketmasterConfigured,
  probeTicketmasterConnection,
} from "./ticketmasterSearch.ts";

const LIVE = Deno.env.get("TICKETMASTER_LIVE_TEST") === "1";

Deno.test({
  name: "probeTicketmasterConnection reaches Discovery API when configured",
  ignore: !LIVE || !isTicketmasterConfigured(),
  fn: async () => {
    const location = {
      lat: 33.274823,
      lon: -111.776872,
      city: "Gilbert",
      state: "AZ",
    };
    const probe = await probeTicketmasterConnection(location);
    if (!probe.ok) {
      throw new Error(probe.message);
    }
    assert(probe.ok);
    const events = await fetchTicketmasterSearchCandidates(location);
    console.log("[ticketmaster:live] retrieved", events.length);
    console.log(
      "[ticketmaster:live] sports",
      events.filter((e) => e.category === "sports").length
    );
  },
});
