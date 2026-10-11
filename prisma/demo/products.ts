/**
 * Demo catalog data (illustrated placeholder products). Used by
 * prisma/demo-seed.ts. Remove demo products before launch.
 */

import * as art from "./artwork";

export const DEMO_NOTE = "\n\n_Demo product with an illustrated placeholder image — replace or delete before launch._";

export type DemoProduct = {
  name: string;
  short: string;
  description: string;
  categories: string[];
  tags: Record<string, string[]>;
  images: string[];
  price?: number;
  salePrice?: number;
  stock?: number;
  options?: { name: string; values: string[] }[];
  variantPrices?: Record<string, number>;
  personalization?: { label: string; type: "TEXT" | "TEXTAREA" | "DATE" | "SELECT"; isRequired: boolean; maxLength?: number; priceDelta?: number; options?: string[]; placeholder?: string }[];
  madeToOrder?: boolean;
  prep?: [number, number];
  quote?: boolean;
  featured?: boolean;
  bestseller?: boolean;
  limited?: boolean;
  track?: boolean;
  collections?: string[];
};

export const PRODUCTS: DemoProduct[] = [
  {
    name: "Concrete candle jar",
    short: "A hand-cast concrete jar filled with scented wax. Refill or reuse it when the candle is done.",
    description: "Each jar is cast by hand, so the surface has small air pockets and tone variations.\n\n- Hand-cast concrete jar\n- Choose your size and scent\n- Add a name on a kraft label",
    categories: ["concrete-candle-jars", "scented-candles"],
    tags: { occasion: ["housewarming", "birthday"], recipient: ["for-her", "for-the-home"], material: ["concrete", "wax"], scent: ["woody"] },
    images: [art.concreteJar("limestone", undefined, 11), art.concreteJar("sage", "Maya", 12)],
    options: [
      { name: "Size", values: ["Small", "Large"] },
      { name: "Scent", values: ["Fig & cedar", "Orange blossom", "Unscented"] },
    ],
    variantPrices: { Small: 1800, Large: 2600 },
    stock: 12,
    personalization: [{ label: "Name on the label", type: "TEXT", isRequired: false, maxLength: 16, priceDelta: 200, placeholder: "Maya" }],
    bestseller: true,
    featured: true,
  },
  {
    name: "Personalized name candle",
    short: "A candle with a name and date written on a kraft tag — a small, personal gift.",
    description: "Poured to order and finished with a hand-lettered tag.",
    categories: ["personalized-candles", "custom-gifts"],
    tags: { occasion: ["birthday", "anniversary"], recipient: ["for-her", "for-mum"], material: ["wax"] },
    images: [art.concreteJar("blush", "Lara", 13), art.keepsakeTag("blush", "Lara", 14)],
    price: 2200,
    track: false,
    madeToOrder: true,
    prep: [3, 5],
    personalization: [
      { label: "Name", type: "TEXT", isRequired: true, maxLength: 16, placeholder: "Lara" },
      { label: "Date", type: "DATE", isRequired: false },
    ],
    featured: true,
  },
  {
    name: "Pair of taper candles",
    short: "Two slim taper candles for the dinner table.",
    description: "Sold as a pair. Holders not included.",
    categories: ["decorative-candles"],
    tags: { recipient: ["for-the-home", "for-couples"], color: ["green", "ivory"], material: ["wax"], scent: ["unscented"] },
    images: [art.taperPair("sage", 15), art.taperPair("limestone", 16)],
    options: [{ name: "Color", values: ["Sage", "Ivory", "Blush"] }],
    price: 1200,
    stock: 20,
  },
  {
    name: "Plaster cross with olive branch",
    short: "A hand-cast plaster cross with a small olive sprig, for a baptism, communion or the home.",
    description: "Finished by hand. Can carry a name and date for a baptism or first communion.",
    categories: ["decorative-crosses", "communion-and-baptism-gifts"],
    tags: { occasion: ["baptism", "first-communion"], recipient: ["for-children"], material: ["plaster"], color: ["white"] },
    images: [art.plasterCross("stone", undefined, 17), art.plasterCross("limestone", "Elias", 18)],
    options: [{ name: "Size", values: ["Small", "Medium"] }],
    variantPrices: { Small: 1600, Medium: 2400 },
    stock: 8,
    personalization: [
      { label: "Name", type: "TEXT", isRequired: false, maxLength: 20, priceDelta: 300 },
      { label: "Date", type: "DATE", isRequired: false },
    ],
  },
  {
    name: "Baptism favor candles",
    short: "Small concrete candles with the baby's name and date — priced per piece.",
    description: "Made to order for your celebration. For quantities above 100, send a custom request.",
    categories: ["baptism-and-communion-favors"],
    tags: { occasion: ["baptism"], recipient: ["for-guests"], material: ["concrete", "wax"] },
    images: [art.favorJars("blush", 19), art.favorJars("sage", 20)],
    price: 450,
    track: false,
    madeToOrder: true,
    prep: [10, 14],
    personalization: [
      { label: "Baby's name", type: "TEXT", isRequired: true, maxLength: 20 },
      { label: "Date", type: "DATE", isRequired: true },
      { label: "Ribbon color", type: "SELECT", isRequired: true, options: ["Blush", "Sky blue", "Sage", "Ivory"] },
    ],
    collections: ["wedding-season"],
  },
  {
    name: "Resin serving tray",
    short: "An oval tray in translucent resin with flecks of gold leaf.",
    description: "Each tray is poured individually; the pattern is never the same twice.",
    categories: ["resin-creations", "decorative-trays"],
    tags: { recipient: ["for-the-home", "for-her"], material: ["resin"], color: ["blue", "gold"] },
    images: [art.resinTray("sea", 21), art.resinTray("limestone", 22)],
    price: 4500,
    stock: 3,
    limited: true,
    collections: ["limited-edition"],
  },
  {
    name: "Concrete trinket dish",
    short: "A small dish for rings and keys.",
    description: "Sealed concrete with a smooth finish.",
    categories: ["handmade-containers", "concrete-and-plaster-decor"],
    tags: { recipient: ["for-her", "for-the-home"], material: ["concrete"], color: ["natural-concrete"] },
    images: [art.trinketDish("stone", 23)],
    price: 900,
    stock: 0,
  },
  {
    name: "Wedding favor jars",
    short: "Mini candle jars for your guests, in your colors and with your names.",
    description: "Priced per event depending on quantity, size, scent and packaging. Send a request with your date and guest count.",
    categories: ["wedding-favors"],
    tags: { occasion: ["wedding", "engagement"], recipient: ["for-guests"], material: ["concrete", "wax"] },
    images: [art.favorJars("limestone", 24)],
    quote: true,
    track: false,
    collections: ["wedding-season"],
  },
  {
    name: "Plaster star ornaments",
    short: "A set of three hand-cast stars to hang on the tree or by a window.",
    description: "Set of three sizes, with gold thread.",
    categories: ["christmas", "christian-ornaments"],
    tags: { occasion: ["christmas"], recipient: ["for-the-home"], material: ["plaster"], color: ["white", "gold"] },
    images: [art.starOrnament("limestone", 25)],
    price: 1400,
    salePrice: 1100,
    stock: 15,
    collections: ["christmas"],
  },
  {
    name: "Engraved keepsake tag",
    short: "A kraft keepsake tag with a name or short message.",
    description: "Lettered by hand. A lovely addition to any gift.",
    categories: ["keepsakes"],
    tags: { occasion: ["birthday", "anniversary"], recipient: ["for-couples"] },
    images: [art.keepsakeTag("limestone", "Rami", 26)],
    price: 1000,
    track: false,
    madeToOrder: true,
    prep: [2, 3],
    personalization: [{ label: "Text", type: "TEXT", isRequired: true, maxLength: 14 }],
  },
  {
    name: "Plaster incense holder",
    short: "A curved plaster dish that catches ash.",
    description: "Hand-cast and sealed.",
    categories: ["concrete-and-plaster-decor"],
    tags: { recipient: ["for-the-home"], material: ["plaster"], color: ["white"] },
    images: [art.incenseHolder("sage", 27)],
    price: 1100,
    stock: 10,
  },
  {
    name: "Mother's Day gift box",
    short: "A concrete candle, an olive sprig and a handwritten card in a gift box.",
    description: "Packed and ready to give. Add your message for the card.",
    categories: ["mothers-day", "gift-candles"],
    tags: { occasion: ["mothers-day"], recipient: ["for-mum"], material: ["concrete", "wax"] },
    images: [art.giftBox("blush", 28), art.concreteJar("blush", undefined, 29)],
    price: 3800,
    stock: 6,
    personalization: [{ label: "Card message", type: "TEXTAREA", isRequired: false, maxLength: 160 }],
    featured: true,
    bestseller: true,
    collections: ["mothers-day"],
  },
];
