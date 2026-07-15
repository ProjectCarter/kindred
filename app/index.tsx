import { Redirect } from "expo-router";
import { markStartup } from "../lib/perf/startupTiming";

/**
 * Root layout already resolved session + interests before the Stack renders.
 * Skip duplicate auth/profile queries — go straight to the morning paper.
 */
export default function Index() {
  markStartup("index_redirect");
  return <Redirect href="/home" />;
}
