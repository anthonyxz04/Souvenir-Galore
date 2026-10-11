/**
 * Starting catalog structure and homepage, shared by prisma/seed.ts (Prisma)
 * and scripts/seed-to-sql.ts (the Netlify Database starting-data migration).
 * No products, reviews, prices, fees, contact details or account numbers.
 */

import type { HomeSectionType } from "@prisma/client";

export const CATEGORIES: { name: string; description: string; children: string[] }[] = [
  {
    name: "Candles & home fragrance",
    description: "Scented candles, concrete candle jars and decorative candles, poured in small batches.",
    children: ["Scented candles", "Concrete candle jars", "Decorative candles", "Gift candles", "Seasonal candles", "Personalized candles"],
  },
  {
    name: "Personalized gifts",
    description: "Gifts and souvenirs made with names, dates and messages — for weddings, birthdays, baptisms and every occasion in between.",
    children: ["Custom gifts", "Wedding favors", "Birthday souvenirs", "Anniversary gifts", "Baptism & Communion favors", "Corporate gifts", "Keepsakes"],
  },
  {
    name: "Religious souvenirs",
    description: "Handmade crosses, keepsakes and decorations for baptisms, communions and the home.",
    children: ["Decorative crosses", "Communion & baptism gifts", "Religious keepsakes", "Christian ornaments", "Religious decorations", "Personalized religious gifts"],
  },
  {
    name: "Home décor & art",
    description: "Trays, containers, sculptures and objects in concrete, plaster and resin for homes and offices.",
    children: ["Decorative trays", "Concrete & plaster décor", "Resin creations", "Sculptures & ornaments", "Handmade containers", "Home & office décor"],
  },
  {
    name: "Seasonal & special",
    description: "Christmas, Valentine's Day, Mother's Day, Easter, wedding season and limited editions.",
    children: ["Christmas", "Valentine's Day", "Mother's Day", "Easter", "Wedding season", "Limited editions", "Holidays & occasions"],
  },
];

export const TAG_GROUPS: { name: string; slug: string; tags: string[] }[] = [
  {
    name: "Occasion",
    slug: "occasion",
    tags: ["Wedding", "Engagement", "Baptism", "First Communion", "Birthday", "Anniversary", "Christmas", "Easter", "Mother's Day", "Valentine's Day", "Housewarming", "Graduation", "Corporate"],
  },
  { name: "Recipient", slug: "recipient", tags: ["For her", "For him", "For mum", "For dad", "For couples", "For children", "For guests", "For colleagues", "For the home"] },
  { name: "Color", slug: "color", tags: ["White", "Ivory", "Natural concrete", "Gold", "Silver", "Black", "Pink", "Blue", "Green"] },
  { name: "Material", slug: "material", tags: ["Wax", "Concrete", "Plaster", "Resin", "Wood", "Glass", "Ceramic"] },
  { name: "Scent", slug: "scent", tags: ["Fresh", "Floral", "Woody", "Sweet", "Spiced", "Unscented"] },
];

export const COLLECTIONS: { name: string; kind: "SEASONAL" | "OCCASION" | "LIMITED"; description: string }[] = [
  { name: "Wedding season", kind: "OCCASION", description: "Favors, table pieces and keepsakes for weddings and engagements." },
  { name: "Christmas", kind: "SEASONAL", description: "Candles, ornaments and gifts for the festive season." },
  { name: "Mother's Day", kind: "SEASONAL", description: "Handmade gifts for mum." },
  { name: "Limited edition", kind: "LIMITED", description: "Small runs that won't be made again." },
];

/** Lebanon's governorates. Created INACTIVE with no fee — the owner sets real fees. */
export const DELIVERY_AREAS = ["Beirut", "Mount Lebanon", "North Lebanon", "Akkar", "Beqaa", "Baalbek-Hermel", "South Lebanon", "Nabatieh"];

export type SectionSeed = {
  type: HomeSectionType;
  title?: string;
  subtitle?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
  config?: { [key: string]: string | number | boolean };
  isVisible?: boolean;
  items?: { title: string; body?: string }[];
};

export const HOME_SECTIONS: SectionSeed[] = [
  {
    type: "HERO",
    title: "Made by hand in Lebanon, for the people you love",
    subtitle: "Candles, keepsakes and favors — poured, cast and finished by hand, and personalized with the names and dates that matter.",
    ctaLabel: "Shop the collection",
    ctaHref: "/shop",
    secondaryCtaLabel: "Start a custom order",
    secondaryCtaHref: "/custom-order",
  },
  { type: "CATEGORY_GRID", title: "Shop by category", ctaLabel: "Shop all", ctaHref: "/shop" },
  { type: "PRODUCT_GRID", title: "Bestsellers", config: { source: "bestsellers", limit: 4 }, ctaLabel: "See more", ctaHref: "/shop?sort=popular" },
  { type: "FEATURED_COLLECTIONS", title: "Seasonal & limited collections", config: { limit: 3 } },
  { type: "PRODUCT_GRID", title: "New in the workshop", config: { source: "new", limit: 8 }, ctaLabel: "All new pieces", ctaHref: "/shop?sort=newest" },
  {
    type: "PERSONALIZATION_STEPS",
    title: "How personalized orders work",
    subtitle: "Names, dates, initials or a short message — added by hand to the piece you choose.",
    ctaLabel: "Request a custom piece",
    ctaHref: "/custom-order",
    items: [
      { title: "Choose a piece", body: "Pick a product marked “Can be personalized”, or describe something new in a custom request." },
      { title: "Add your details", body: "Type the names, date or message exactly as you'd like them. We check the spelling with you if anything is unclear." },
      { title: "We make it by hand", body: "Your piece is made to order. You'll see the making time on each product, and we keep you updated." },
    ],
  },
  { type: "PRODUCT_GRID", title: "Made to be personalized", config: { source: "personalizable", limit: 4 }, ctaLabel: "All personalizable pieces", ctaHref: "/shop?personalizable=1" },
  {
    type: "CRAFTSMANSHIP",
    isVisible: false,
    title: "From raw material to keepsake",
    subtitle: "Replace this with your own story before showing this section.",
    body: "Tell customers who makes the pieces, where the workshop is, which materials you use and why. Add a photo of your hands at work.",
    ctaLabel: "Our story",
    ctaHref: "/about",
  },
  { type: "TESTIMONIALS", title: "From our customers" },
  { type: "INSTAGRAM", title: "Follow the workshop" },
  { type: "NEWSLETTER" },
];
