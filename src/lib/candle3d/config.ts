/**
 * The 3D candle preview: what the owner sets per product, and how a
 * customer's choices on the product page turn into what the candle looks like.
 *
 * Nothing here draws anything (see ./scene.ts); it's plain data so it can be
 * validated on the server, tested, and shared by the product page and editor.
 *
 * A "choice" is anything the customer picks or types on the product page:
 * a product option that has its own price and stock (Jar color: Charcoal), or
 * a personalization field (Name on the candle: Maya, Font: Script). The owner
 * links choices to parts of the candle; every other choice still works and is
 * saved with the order, it just doesn't change the picture.
 */

import { z } from "zod";

export const CANDLE_SHAPES = ["tumbler", "tapered", "bowl", "pillar"] as const;
export type CandleShape = (typeof CANDLE_SHAPES)[number];
export const CANDLE_SHAPE_LABELS: Record<CandleShape, string> = {
  tumbler: "Straight jar",
  tapered: "Tapered jar (wider at the top)",
  bowl: "Low bowl",
  pillar: "Pillar candle (no jar)",
};

export const LID_STYLES = ["none", "wood", "concrete", "gold", "black"] as const;
export type LidStyle = (typeof LID_STYLES)[number];
export const LID_STYLE_LABELS: Record<LidStyle, string> = {
  none: "No lid",
  wood: "Wood",
  concrete: "Concrete",
  gold: "Gold metal",
  black: "Matte black",
};

export const LABEL_FONTS = ["serif", "script", "sans"] as const;
export type LabelFont = (typeof LABEL_FONTS)[number];
export const LABEL_FONT_LABELS: Record<LabelFont, string> = { serif: "Classic", script: "Handwritten", sans: "Modern" };

export const SIZE_MIN = 0.6;
export const SIZE_MAX = 1.6;
export const MAX_LABEL_LINES = 3;

const hex = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a color like #b9b4ab.");
const choiceName = z.string().trim().max(80);
const valueMap = <T extends z.ZodTypeAny>(value: T) => z.record(z.string().trim().min(1).max(100), value).default({});

export const preview3dSchema = z.object({
  enabled: z.boolean().default(false),
  shape: z.enum(CANDLE_SHAPES).default("tumbler"),
  // How the candle looks before the customer picks anything.
  jarColor: hex.default("#b9b4ab"),
  waxColor: hex.default("#f3ead8"),
  lid: z.enum(LID_STYLES).default("none"),
  font: z.enum(LABEL_FONTS).default("serif"),
  showLabel: z.boolean().default(true),
  labelColor: hex.default("#f6f1e7"),
  textColor: hex.default("#2f2d29"),
  /** Shown on the label until the customer types something. */
  placeholderText: z.string().trim().max(40).default(""),
  // Which customer choice changes which part (choice names; "" = none).
  bindings: z
    .object({
      jarColor: choiceName.default(""),
      waxColor: choiceName.default(""),
      size: choiceName.default(""),
      lid: choiceName.default(""),
      font: choiceName.default(""),
      labelText: z.array(choiceName).max(MAX_LABEL_LINES).default([]),
    })
    .default({}),
  // What each value of a linked choice looks like.
  jarColors: valueMap(hex),
  waxColors: valueMap(hex),
  sizes: valueMap(z.number().min(SIZE_MIN).max(SIZE_MAX)),
  lids: valueMap(z.enum(LID_STYLES)),
  fonts: valueMap(z.enum(LABEL_FONTS)),
});

export type Preview3dConfig = z.infer<typeof preview3dSchema>;

/** The stored value (or anything else) as a complete, valid config. */
export function parsePreview3d(raw: unknown): Preview3dConfig {
  const result = preview3dSchema.safeParse(raw && typeof raw === "object" ? raw : {});
  return result.success ? result.data : preview3dSchema.parse({});
}

// ─────────────────────────────────────────────────────────────
// Customer choices → the look of the candle
// ─────────────────────────────────────────────────────────────

export type ChoiceKind = "option" | "select" | "text";
export type Choice = { name: string; kind: ChoiceKind; values: string[] };
/** The choices a product offers, in page order. */
export function productChoices(product: {
  options: { name: string; values: string[] }[];
  personalizationFields: { label: string; type: string; options: string[] }[];
}): Choice[] {
  return [
    ...product.options.map((o) => ({ name: o.name, kind: "option" as const, values: o.values })),
    ...product.personalizationFields.map((f) =>
      f.type === "SELECT" ? { name: f.label, kind: "select" as const, values: f.options } : { name: f.label, kind: "text" as const, values: [] },
    ),
  ];
}

export type CandleLook = {
  shape: CandleShape;
  jarColor: string;
  waxColor: string;
  lid: LidStyle;
  font: LabelFont;
  scale: number;
  showLabel: boolean;
  labelColor: string;
  textColor: string;
  lines: string[];
  /** True when the lines are the owner's placeholder, not the customer's text. */
  placeholder: boolean;
};

/** Current customer selection: choice name → picked value or typed text. */
export type Selection = Record<string, string | null | undefined>;

export function resolveLook(config: Preview3dConfig, selection: Selection, productName = ""): CandleLook {
  const picked = (binding: string) => (binding ? (selection[binding] ?? "").trim() : "");
  const from = <T>(map: Record<string, T>, binding: string, fallback: T): T => {
    const value = picked(binding);
    return value && map[value] !== undefined ? map[value] : fallback;
  };

  const typed = config.bindings.labelText.map((name) => labelLine(picked(name))).filter(Boolean);
  const placeholderLines = (config.placeholderText || productName).trim();
  return {
    shape: config.shape,
    jarColor: from(config.jarColors, config.bindings.jarColor, config.jarColor),
    waxColor: from(config.waxColors, config.bindings.waxColor, config.waxColor),
    lid: from(config.lids, config.bindings.lid, config.lid),
    font: from(config.fonts, config.bindings.font, config.font),
    scale: from(config.sizes, config.bindings.size, 1),
    showLabel: config.showLabel,
    labelColor: config.labelColor,
    textColor: config.textColor,
    lines: (typed.length ? typed : placeholderLines ? [placeholderLines] : []).map((line) => line.slice(0, 40)).slice(0, MAX_LABEL_LINES),
    placeholder: typed.length === 0,
  };
}

/** Dates from a date field (2026-06-12) are printed the way they're written in Lebanon: 12.06.2026. */
function labelLine(value: string): string {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return date ? `${date[3]}.${date[2]}.${date[1]}` : value;
}

/** A short sentence describing the candle, for screen readers. */
export function describeLook(look: CandleLook, names: { jar?: string; wax?: string; lid?: string } = {}): string {
  const parts = [
    look.shape === "pillar" ? "A pillar candle" : `A candle in a ${names.jar ? `${names.jar.toLowerCase()} ` : ""}${CANDLE_SHAPE_LABELS[look.shape].toLowerCase()}`,
    names.wax ? `with ${names.wax.toLowerCase()} wax` : null,
    look.lid !== "none" ? `and a ${(names.lid ?? LID_STYLE_LABELS[look.lid]).toLowerCase()} lid` : null,
  ].filter(Boolean);
  const text = look.showLabel && look.lines.length && !look.placeholder ? `. The label reads “${look.lines.join(" / ")}”` : "";
  return `${parts.join(" ")}${text}.`;
}

// ─────────────────────────────────────────────────────────────
// Suggestions for the editor (the owner can change everything)
// ─────────────────────────────────────────────────────────────

const PATTERNS = {
  jarColor: /\b(jar|vessel|container|pot|concrete|holder|cement)\b/i,
  waxColor: /\bwax\b/i,
  size: /\b(size|volume|weight|dimension)s?\b/i,
  lid: /\b(lid|cover|cap|top)\b/i,
  font: /\b(font|lettering|typeface|writing|text style)\b/i,
};
const GENERIC_COLOR = /\b(colou?r|finish|shade)\b/i;

/** Guess which choice should drive which part, from the choice names. */
export function suggestBindings(choices: Choice[]): Preview3dConfig["bindings"] {
  const pickable = choices.filter((c) => c.kind !== "text");
  const find = (pattern: RegExp, exclude: string[] = []) => pickable.find((c) => pattern.test(c.name) && !exclude.includes(c.name))?.name ?? "";
  const waxColor = find(PATTERNS.waxColor);
  let jarColor = find(PATTERNS.jarColor, [waxColor]);
  if (!jarColor) jarColor = find(GENERIC_COLOR, [waxColor]);
  const taken = [jarColor, waxColor];
  const size = find(PATTERNS.size, taken);
  const lid = find(PATTERNS.lid, [...taken, size]);
  const font = find(PATTERNS.font, [...taken, size, lid]);
  const labelText = choices
    .filter((c) => c.kind === "text")
    .map((c) => c.name)
    .slice(0, 2);
  return { jarColor, waxColor, size, lid, font, labelText };
}

const NAMED_COLORS: [RegExp, string][] = [
  [/charcoal|graphite|anthracite/i, "#4a4845"],
  [/black|noir|onyx/i, "#2b2a28"],
  [/white|snow|chalk/i, "#f2efea"],
  [/ivory|vanilla/i, "#f3ead8"],
  [/cream|off.?white|milk/i, "#eee3cb"],
  [/natural|raw|concrete|cement|stone/i, "#bab5ac"],
  [/gr[ae]y|silver|ash/i, "#9b978f"],
  [/terra.?cotta|clay|rust/i, "#c0694a"],
  [/blush|pink|rose/i, "#e6c1ba"],
  [/sage|mint|green|olive/i, "#a8b597"],
  [/sand|beige|nude|oat/i, "#d9c8a9"],
  [/brown|choco|coffee|mocha|walnut/i, "#7a5a44"],
  [/gold|brass|honey|mustard/i, "#c9a14a"],
  [/navy|midnight/i, "#33405a"],
  [/blue|sky|ocean/i, "#90a7bd"],
  [/red|burgundy|wine|cherry/i, "#9e3f3a"],
  [/lavender|lilac|purple|violet/i, "#b5a6c8"],
  [/yellow|lemon|butter/i, "#ead07c"],
  [/orange|peach|apricot/i, "#e7a77a"],
];
const FALLBACK_COLORS = ["#c9b8a3", "#a9b2a1", "#c7a9a4", "#a6adba", "#cdbf9c", "#b4a6b8"];

/** A sensible color for a value like "Charcoal" or "Sage green". */
export function suggestColor(value: string): string {
  const match = NAMED_COLORS.find(([pattern]) => pattern.test(value));
  if (match) return match[1];
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

/** Relative sizes for values like "Small / Medium / Large" or "180 g / 300 g". */
export function suggestSizes(values: string[]): Record<string, number> {
  const keyword = (v: string) =>
    /\b(xs|mini|tiny)\b/i.test(v) ? 0.7 : /\b(s|small|petite)\b/i.test(v) ? 0.85 : /\b(m|medium|regular|standard)\b/i.test(v) ? 1 : /\b(xl|extra.?large|grand)\b/i.test(v) ? 1.32 : /\b(l|large|big)\b/i.test(v) ? 1.16 : null;
  const numbers = values.map((v) => Number((v.match(/\d+(\.\d+)?/) ?? [])[0]));
  const result: Record<string, number> = {};
  if (values.every((v) => keyword(v) !== null)) {
    for (const v of values) result[v] = keyword(v)!;
    return result;
  }
  if (numbers.every((n) => Number.isFinite(n) && n > 0)) {
    // Scale by volume: linear size grows with the cube root of grams/ml.
    const ref = numbers.slice().sort((a, b) => a - b)[Math.floor((numbers.length - 1) / 2)];
    values.forEach((v, i) => (result[v] = clampSize(Math.cbrt(numbers[i] / ref))));
    return result;
  }
  const step = values.length > 1 ? 0.45 / (values.length - 1) : 0;
  values.forEach((v, i) => (result[v] = clampSize(0.85 + i * step)));
  return result;
}

function clampSize(n: number): number {
  return Math.round(Math.min(SIZE_MAX, Math.max(SIZE_MIN, n)) * 100) / 100;
}

export function suggestLid(value: string): LidStyle {
  if (/\b(no|none|without)\b/i.test(value)) return "none";
  if (/wood|oak|bamboo|walnut/i.test(value)) return "wood";
  if (/gold|brass|copper|metal/i.test(value)) return "gold";
  if (/black/i.test(value)) return "black";
  if (/concrete|cement|stone/i.test(value)) return "concrete";
  return "wood";
}

export function suggestFont(value: string): LabelFont {
  if (/script|cursive|hand|calligraph/i.test(value)) return "script";
  if (/sans|modern|simple|minimal/i.test(value)) return "sans";
  return "serif";
}

/**
 * Fill in the per-value looks for the linked choices, keeping anything the
 * owner already chose, and dropping values that no longer exist.
 */
export function completeValueLooks(config: Preview3dConfig, choices: Choice[]): Preview3dConfig {
  const valuesOf = (name: string) => choices.find((c) => c.name === name)?.values ?? [];
  const fill = <T>(current: Record<string, T>, name: string, suggest: (values: string[]) => Record<string, T>): Record<string, T> => {
    const values = valuesOf(name);
    const suggested = suggest(values);
    return Object.fromEntries(values.map((v) => [v, current[v] ?? suggested[v]]));
  };
  const each = <T>(fn: (v: string) => T) => (values: string[]) => Object.fromEntries(values.map((v) => [v, fn(v)]));
  return {
    ...config,
    jarColors: fill(config.jarColors, config.bindings.jarColor, each(suggestColor)),
    waxColors: fill(config.waxColors, config.bindings.waxColor, each(suggestColor)),
    sizes: fill(config.sizes, config.bindings.size, suggestSizes),
    lids: fill(config.lids, config.bindings.lid, each(suggestLid)),
    fonts: fill(config.fonts, config.bindings.font, each(suggestFont)),
  };
}

/**
 * Make saved settings consistent with the product's current choices: links to
 * choices that were renamed or removed are cleared, and per-value looks are
 * filled in for new values and dropped for removed ones.
 */
export function normalizePreview3d(config: Preview3dConfig, choices: Choice[]): Preview3dConfig {
  const pickable = new Set(choices.filter((c) => c.kind !== "text").map((c) => c.name));
  const texts = new Set(choices.filter((c) => c.kind === "text").map((c) => c.name));
  const keep = (name: string) => (pickable.has(name) ? name : "");
  const bindings = {
    jarColor: keep(config.bindings.jarColor),
    waxColor: keep(config.bindings.waxColor),
    size: keep(config.bindings.size),
    lid: keep(config.bindings.lid),
    font: keep(config.bindings.font),
    labelText: [...new Set(config.bindings.labelText.filter((name) => texts.has(name)))].slice(0, MAX_LABEL_LINES),
  };
  return completeValueLooks({ ...config, bindings }, choices);
}
