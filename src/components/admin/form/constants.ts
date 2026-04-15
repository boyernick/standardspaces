// Constants shared by the admin Review (/admin/review/[id]) and Edit
// (/admin/listings/[id]) forms. Both screens render the same editable
// spot schema, so any list/option that appears on one screen should appear
// on the other — keep them here.

export const MIAMI_NEIGHBORHOODS = [
  "Aventura", "Bal Harbour", "Bay Harbor Islands", "Brickell", "Coconut Grove",
  "Coral Gables", "Design District", "Downtown", "Edgewater", "Fisher Island",
  "Key Biscayne", "Little Haiti", "Little Havana", "Miami Beach", "Miami Shores",
  "Midtown", "North Beach", "South Beach", "Surfside", "Sunny Isles Beach",
  "Upper East Side", "Wynwood",
];

export const CITIES = ["Miami"];

export const DRESS_CODES = [
  "Casual",
  "Smart casual",
  "Business casual",
  "Upscale",
  "Formal",
  "Resort chic",
  "No dress code",
];

export const PARKING_OPTIONS = [
  "Valet",
  "Valet & self-park",
  "Street parking",
  "Parking garage",
  "Parking lot",
  "Limited street parking",
  "No dedicated parking",
];

export const PRICE_RANGES = ["$", "$$", "$$$", "$$$$"];

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type Day = typeof DAYS[number];
