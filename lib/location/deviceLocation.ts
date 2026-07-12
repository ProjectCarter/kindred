/**
 * Compatibility barrel — prefer importing from kindredLocation.
 * Kept so existing imports of deviceLocation continue to work.
 */
export {
  resolveDeviceLocation,
  resolveActivePlace,
  getActiveLocation,
  getLocationPrefs,
  setModeCurrent,
  setHomeCity,
  setTravelCity,
  clearTravelLocation,
  returnToHomeCity,
  markFirstRunCompleted,
  isFirstRunPending,
  fetchCurrentGpsPlace,
  searchCities,
  locationPayload,
  persistLocationToProfile,
  type DeviceLocation,
} from "./kindredLocation";

export type {
  KindredPlace,
  LocationMode,
  LocationPrefs,
  ActiveLocation,
} from "./types";

export { formatPlaceLabel, SUGGESTED_CITIES } from "./cities";
