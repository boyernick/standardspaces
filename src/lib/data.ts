import { Spot } from "./types";

export const spots: Spot[] = [
  {
    id: "maison-flora",
    name: "Maison Flora",
    category: "restaurant",
    neighborhood: "Design District",
    city: "Miami",
    description:
      "An intimate dining room with a seasonal tasting menu that draws from coastal Mediterranean and Japanese traditions. Omakase-style service, natural wine list, impeccable attention to detail.",
    address: "140 NE 39th St, Miami, FL 33137",
    image: "/placeholder.jpg",
  },
  {
    id: "côte-sud",
    name: "Côte Sud",
    category: "restaurant",
    neighborhood: "South Beach",
    city: "Miami",
    description:
      "French-inflected seafood in a serene oceanfront setting. The raw bar is among the best in the city — pristine oysters, crudo, and a caviar service worth every dollar.",
    address: "321 Ocean Dr, Miami Beach, FL 33139",
    image: "/placeholder.jpg",
  },
  {
    id: "nori-omakase",
    name: "Nori Omakase",
    category: "restaurant",
    neighborhood: "Brickell",
    city: "Miami",
    description:
      "A twelve-seat counter serving a meticulous twenty-course omakase. The fish is flown in daily from Tsukiji. Reservations open thirty days out and disappear within minutes.",
    address: "801 Brickell Ave, Miami, FL 33131",
    image: "/placeholder.jpg",
  },
  {
    id: "velvet-room",
    name: "Velvet Room",
    category: "bar",
    neighborhood: "Wynwood",
    city: "Miami",
    description:
      "A dimly lit cocktail den behind an unmarked door. The bartenders work with house-made tinctures and rare spirits. No menu — tell them what you like and trust the process.",
    address: "2550 NW 2nd Ave, Miami, FL 33127",
    image: "/placeholder.jpg",
  },
  {
    id: "apertura",
    name: "Apertura",
    category: "bar",
    neighborhood: "Coral Gables",
    city: "Miami",
    description:
      "An elegant aperitivo bar modeled after the grand cafés of Milan. Negroni variations, a curated amaro collection, and complimentary cicchetti during golden hour.",
    address: "260 Miracle Mile, Coral Gables, FL 33134",
    image: "/placeholder.jpg",
  },
  {
    id: "club-nocturne",
    name: "Club Nocturne",
    category: "club",
    neighborhood: "South Beach",
    city: "Miami",
    description:
      "The city's most discerning late-night destination. World-class sound system, rotating international DJs, and a door policy that keeps the room right. Table service is an experience unto itself.",
    address: "1235 Washington Ave, Miami Beach, FL 33139",
    image: "/placeholder.jpg",
  },
  {
    id: "the-temple",
    name: "The Temple",
    category: "gym",
    neighborhood: "Edgewater",
    city: "Miami",
    description:
      "A private training facility with top-tier equipment, cold plunge pools, infrared saunas, and a roster of elite coaches. Membership is by referral only.",
    address: "480 NE 31st St, Miami, FL 33137",
    image: "/placeholder.jpg",
  },
  {
    id: "forma-athletics",
    name: "Forma Athletics",
    category: "gym",
    neighborhood: "Brickell",
    city: "Miami",
    description:
      "Boutique performance gym with a focus on functional movement and recovery. The space is minimal and pristine — concrete, oak, and natural light. Classes are capped at eight.",
    address: "1010 Brickell Ave, Miami, FL 33131",
    image: "/placeholder.jpg",
  },
  {
    id: "drift-coffee",
    name: "Drift Coffee",
    category: "coffee",
    neighborhood: "Wynwood",
    city: "Miami",
    description:
      "Single-origin pour-overs and a rotating espresso menu in a light-filled industrial space. The beans are roasted in-house weekly. Their cortado is a quiet masterpiece.",
    address: "2700 N Miami Ave, Miami, FL 33127",
    image: "/placeholder.jpg",
  },
  {
    id: "café-lento",
    name: "Café Lento",
    category: "coffee",
    neighborhood: "Coconut Grove",
    city: "Miami",
    description:
      "A slow coffee experience in a lush garden setting. Japanese kissaten influences meet Miami warmth. The matcha latte and house-baked financiers are essential.",
    address: "3444 Main Hwy, Miami, FL 33133",
    image: "/placeholder.jpg",
  },
  {
    id: "maison-ligne",
    name: "Maison Ligne",
    category: "clothing",
    neighborhood: "Design District",
    city: "Miami",
    description:
      "A carefully edited multi-brand boutique carrying European and Japanese labels. The buying is sharp — expect to find pieces here before they appear anywhere else in the city.",
    address: "110 NE 40th St, Miami, FL 33137",
    image: "/placeholder.jpg",
  },
  {
    id: "the-archive",
    name: "The Archive",
    category: "clothing",
    neighborhood: "South Beach",
    city: "Miami",
    description:
      "Curated vintage and contemporary menswear in a gallery-like space. Rare archival pieces sit alongside emerging designers. The owner's eye is unerring.",
    address: "631 Lincoln Rd, Miami Beach, FL 33139",
    image: "/placeholder.jpg",
  },
];

export function getSpotsByCity(city: string): Spot[] {
  return spots.filter((s) => s.city.toLowerCase() === city.toLowerCase());
}

export function getSpotById(id: string): Spot | undefined {
  return spots.find((s) => s.id === id);
}

export function getCategories(city: string): string[] {
  const citySpots = getSpotsByCity(city);
  return [...new Set(citySpots.map((s) => s.category))];
}
