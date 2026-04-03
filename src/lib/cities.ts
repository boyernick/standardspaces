export const CITIES = [
  { name: "Miami", slug: "miami" },
  { name: "New York", slug: "new-york" },
  { name: "San Francisco", slug: "san-francisco" },
  { name: "Austin", slug: "austin" },
  { name: "Los Angeles", slug: "los-angeles" },
] as const;

export type CitySlug = (typeof CITIES)[number]["slug"];
export type CityName = (typeof CITIES)[number]["name"];

const slugToName = new Map<string, string>(CITIES.map((c) => [c.slug, c.name]));
const nameToSlug = new Map<string, string>(CITIES.map((c) => [c.name, c.slug]));

export function cityNameFromSlug(slug: string): string | undefined {
  return slugToName.get(slug);
}

export function citySlugFromName(name: string): string {
  return nameToSlug.get(name) ?? name.toLowerCase().replace(/ /g, "-");
}

export function isValidCitySlug(slug: string): slug is CitySlug {
  return slugToName.has(slug);
}
