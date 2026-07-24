/**
 * Local Deals loader — a thin, synchronous state machine over the placeholder
 * catalog. It exposes real loading / ready / error / empty states so the See All
 * screen never feels broken and so a future affiliate feed can drop in behind the
 * same hook without touching the UI.
 */
import { useEffect, useState } from "react";
import {
  allLocalDeals,
  localDealsByCategory,
  type DealCategoryGroup,
  type LocalDeal,
} from "./localDeals";

export type LocalDealsStatus = "loading" | "ready" | "empty" | "error";

export type LocalDealsState = {
  status: LocalDealsStatus;
  deals: LocalDeal[];
  groups: DealCategoryGroup[];
};

export function useLocalDeals(): LocalDealsState {
  const [state, setState] = useState<LocalDealsState>({
    status: "loading",
    deals: [],
    groups: [],
  });

  useEffect(() => {
    let cancelled = false;
    try {
      const deals = allLocalDeals();
      const groups = localDealsByCategory();
      if (cancelled) return;
      setState({
        status: deals.length > 0 ? "ready" : "empty",
        deals,
        groups,
      });
    } catch {
      if (cancelled) return;
      setState({ status: "error", deals: [], groups: [] });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
