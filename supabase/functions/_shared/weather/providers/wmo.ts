/** Map OpenWeather condition ids to WMO weather_code (Open-Meteo compatible). */

export function openWeatherIdToWmo(id: number): number {
  if (id === 800) return 0;
  if (id === 801) return 1;
  if (id === 802) return 2;
  if (id === 803 || id === 804) return 3;
  if (id >= 200 && id <= 232) return 95;
  if (id >= 300 && id <= 321) return 53;
  if (id >= 500 && id <= 504) return 61;
  if (id === 511) return 67;
  if (id >= 520 && id <= 531) return 80;
  if (id >= 600 && id <= 622) return 71;
  if (id >= 701 && id <= 781) return 45;
  return 3;
}

export function primaryOpenWeatherId(weather: Array<{ id?: number }> | undefined): number {
  return weather?.[0]?.id ?? 800;
}
