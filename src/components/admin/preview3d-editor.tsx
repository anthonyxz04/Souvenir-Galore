"use client";

import { useMemo, useState } from "react";
import {
  CANDLE_SHAPE_LABELS,
  CANDLE_SHAPES,
  LABEL_FONT_LABELS,
  LABEL_FONTS,
  LID_STYLE_LABELS,
  LID_STYLES,
  MAX_LABEL_LINES,
  SIZE_MAX,
  SIZE_MIN,
  completeValueLooks,
  describeLook,
  resolveLook,
  suggestBindings,
  type CandleShape,
  type Choice,
  type LabelFont,
  type LidStyle,
  type Preview3dConfig,
} from "@/lib/candle3d/config";
import { cn } from "@/lib/utils";
import { buttonClass } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { CandleViewer } from "@/components/candle3d/candle-viewer";

type Part = "jarColor" | "waxColor" | "size" | "lid" | "font";
const PARTS: { key: Part; label: string; jarOnly?: boolean }[] = [
  { key: "jarColor", label: "Jar color", jarOnly: true },
  { key: "waxColor", label: "Wax color" },
  { key: "size", label: "Size" },
  { key: "lid", label: "Lid", jarOnly: true },
  { key: "font", label: "Lettering style" },
];

function ColorInput({ id, value, onChange, label }: { id: string; value: string; onChange: (v: string) => void; label: string }) {
  return (
    <label htmlFor={id} className="inline-flex items-center gap-2 text-sm">
      <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 cursor-pointer rounded-lg border border-line bg-white p-1" aria-label={label} />
      <span className="font-mono text-xs text-ink-soft">{value}</span>
    </label>
  );
}

/**
 * Editor panel for the 3D candle preview: shape, which customer choices change
 * which part of the candle, what each choice value looks like, the label, and
 * a live preview.
 */
export function Preview3dEditor({ value, onChange, choices, productName }: { value: Preview3dConfig; onChange: (next: Preview3dConfig) => void; choices: Choice[]; productName: string }) {
  const pickable = choices.filter((c) => c.kind !== "text" && c.values.length > 0);
  const texts = choices.filter((c) => c.kind === "text");
  const set = (patch: Partial<Preview3dConfig>) => onChange(completeValueLooks({ ...value, ...patch }, choices));
  const setBinding = (part: Part, name: string) => set({ bindings: { ...value.bindings, [part]: name } });
  const isJar = value.shape !== "pillar";

  // Preview: try each linked choice and some sample text.
  const [sample, setSample] = useState<Record<string, string>>({});
  const previewSelection = useMemo(() => {
    const selection: Record<string, string> = {};
    for (const part of PARTS) {
      const name = value.bindings[part.key];
      if (name) selection[name] = sample[name] ?? choices.find((c) => c.name === name)?.values[0] ?? "";
    }
    for (const name of value.bindings.labelText) if (sample[name]) selection[name] = sample[name];
    return selection;
  }, [value.bindings, sample, choices]);
  const look = useMemo(() => resolveLook(value, previewSelection, productName), [value, previewSelection, productName]);

  const perValue = (part: Part, name: string) => {
    const values = choices.find((c) => c.name === name)?.values ?? [];
    return (
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {values.map((v, i) => {
          const id = `p3d-${part}-${i}`;
          return (
            <li key={v} className="flex items-center justify-between gap-3 rounded-lg bg-white/80 px-3 py-2 ring-1 ring-line/60">
              <span className="min-w-0 truncate text-sm">{v}</span>
              {part === "jarColor" || part === "waxColor" ? (
                <ColorInput
                  id={id}
                  label={`${part === "jarColor" ? "Jar" : "Wax"} color for ${v}`}
                  value={(part === "jarColor" ? value.jarColors : value.waxColors)[v] ?? "#cccccc"}
                  onChange={(color) => set(part === "jarColor" ? { jarColors: { ...value.jarColors, [v]: color } } : { waxColors: { ...value.waxColors, [v]: color } })}
                />
              ) : part === "size" ? (
                <label htmlFor={id} className="flex items-center gap-2 text-sm">
                  <input
                    id={id}
                    type="range"
                    min={SIZE_MIN * 100}
                    max={SIZE_MAX * 100}
                    step={5}
                    value={Math.round((value.sizes[v] ?? 1) * 100)}
                    onChange={(e) => set({ sizes: { ...value.sizes, [v]: Number(e.target.value) / 100 } })}
                    aria-label={`Size of ${v}`}
                    className="w-28 accent-olive"
                  />
                  <span className="w-11 text-right text-xs text-ink-soft">{Math.round((value.sizes[v] ?? 1) * 100)}%</span>
                </label>
              ) : part === "lid" ? (
                <select id={id} aria-label={`Lid for ${v}`} className={cn(controlClass, "w-36 py-1.5")} value={value.lids[v] ?? "none"} onChange={(e) => set({ lids: { ...value.lids, [v]: e.target.value as LidStyle } })}>
                  {LID_STYLES.map((style) => (
                    <option key={style} value={style}>
                      {LID_STYLE_LABELS[style]}
                    </option>
                  ))}
                </select>
              ) : (
                <select id={id} aria-label={`Lettering for ${v}`} className={cn(controlClass, "w-36 py-1.5")} value={value.fonts[v] ?? "serif"} onChange={(e) => set({ fonts: { ...value.fonts, [v]: e.target.value as LabelFont } })}>
                  {LABEL_FONTS.map((font) => (
                    <option key={font} value={font}>
                      {LABEL_FONT_LABELS[font]}
                    </option>
                  ))}
                </select>
              )}
            </li>
          );
        })}
      </ul>
    );
  };

  const fixed = (part: Part) => {
    const id = `p3d-fixed-${part}`;
    if (part === "jarColor") return <ColorInput id={id} label="Jar color" value={value.jarColor} onChange={(jarColor) => set({ jarColor })} />;
    if (part === "waxColor") return <ColorInput id={id} label="Wax color" value={value.waxColor} onChange={(waxColor) => set({ waxColor })} />;
    if (part === "size") return <span className="text-sm text-ink-soft">One size</span>;
    if (part === "lid")
      return (
        <select id={id} aria-label="Lid" className={cn(controlClass, "w-40 py-1.5")} value={value.lid} onChange={(e) => set({ lid: e.target.value as LidStyle })}>
          {LID_STYLES.map((style) => (
            <option key={style} value={style}>
              {LID_STYLE_LABELS[style]}
            </option>
          ))}
        </select>
      );
    return (
      <select id={id} aria-label="Lettering style" className={cn(controlClass, "w-40 py-1.5")} value={value.font} onChange={(e) => set({ font: e.target.value as LabelFont })}>
        {LABEL_FONTS.map((font) => (
          <option key={font} value={font}>
            {LABEL_FONT_LABELS[font]}
          </option>
        ))}
      </select>
    );
  };

  return (
    <div className="space-y-5">
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" checked={value.enabled} onChange={(e) => set({ enabled: e.target.checked })} className="mt-0.5 h-5 w-5 shrink-0 accent-olive" />
        <span>
          <span className="block text-[0.9375rem]">Show a 3D preview on the product page</span>
          <span className="block text-[0.8125rem] text-ink-soft">Customers turn the candle around and see their choices and their text on it as they pick. Their choices go into the cart as usual.</span>
        </span>
      </label>

      {value.enabled ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="space-y-6">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label htmlFor="p3d-shape" className="mb-1.5 block text-sm font-medium">
                  Shape
                </label>
                <select id="p3d-shape" className={cn(controlClass, "w-64")} value={value.shape} onChange={(e) => set({ shape: e.target.value as CandleShape })}>
                  {CANDLE_SHAPES.map((shape) => (
                    <option key={shape} value={shape}>
                      {CANDLE_SHAPE_LABELS[shape]}
                    </option>
                  ))}
                </select>
              </div>
              {pickable.length || texts.length ? (
                <button
                  type="button"
                  className={buttonClass("secondary", "sm")}
                  onClick={() => onChange(completeValueLooks({ ...value, bindings: suggestBindings(choices) }, choices))}
                >
                  Link my options automatically
                </button>
              ) : null}
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold">What customers can change</h3>
                <p className="text-[0.8125rem] text-ink-soft">
                  {pickable.length
                    ? "Link a part of the candle to one of this product's options or choice lists, then set how each value looks."
                    : "Add options (like Jar color or Size) or a choice list in Personalization, and you can link them here."}
                </p>
              </div>
              {PARTS.filter((part) => isJar || !part.jarOnly).map((part) => {
                const linked = value.bindings[part.key];
                return (
                  <div key={part.key} className="rounded-xl bg-white/60 p-3 ring-1 ring-line/60">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-[0.9375rem] font-medium">{part.label}</span>
                      <div className="flex flex-wrap items-center gap-3">
                        {pickable.length ? (
                          <select
                            aria-label={`${part.label} changes with`}
                            className={cn(controlClass, "w-52 py-1.5")}
                            value={linked}
                            onChange={(e) => setBinding(part.key, e.target.value)}
                          >
                            <option value="">Same for everyone</option>
                            {pickable.map((choice) => (
                              <option key={choice.name} value={choice.name}>
                                Changes with “{choice.name}”
                              </option>
                            ))}
                          </select>
                        ) : null}
                        {!linked ? fixed(part.key) : null}
                      </div>
                    </div>
                    {linked ? perValue(part.key, linked) : null}
                  </div>
                );
              })}
            </div>

            <div className="space-y-3">
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" checked={value.showLabel} onChange={(e) => set({ showLabel: e.target.checked })} className="mt-0.5 h-5 w-5 shrink-0 accent-olive" />
                <span className="text-[0.9375rem]">Print a label with the customer&apos;s text</span>
              </label>
              {value.showLabel ? (
                <div className="space-y-3 rounded-xl bg-white/60 p-3 ring-1 ring-line/60">
                  {texts.length ? (
                    <fieldset>
                      <legend className="text-sm font-medium">Text on the label (up to {MAX_LABEL_LINES} lines)</legend>
                      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
                        {texts.map((choice) => {
                          const checked = value.bindings.labelText.includes(choice.name);
                          return (
                            <label key={choice.name} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-olive"
                                checked={checked}
                                disabled={!checked && value.bindings.labelText.length >= MAX_LABEL_LINES}
                                onChange={(e) =>
                                  set({
                                    bindings: {
                                      ...value.bindings,
                                      labelText: e.target.checked ? [...value.bindings.labelText, choice.name] : value.bindings.labelText.filter((n) => n !== choice.name),
                                    },
                                  })
                                }
                              />
                              {choice.name}
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  ) : (
                    <p className="text-[0.8125rem] text-ink-soft">Add a personalization field such as “Name on the candle” and you can print it on the label.</p>
                  )}
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                    <div>
                      <label htmlFor="p3d-placeholder" className="mb-1.5 block text-sm font-medium">
                        Label text before they type
                      </label>
                      <input id="p3d-placeholder" className={controlClass} maxLength={40} value={value.placeholderText} placeholder={productName || "Your name here"} onChange={(e) => set({ placeholderText: e.target.value })} />
                    </div>
                    <div>
                      <span className="mb-1.5 block text-sm font-medium">Label</span>
                      <ColorInput id="p3d-label-color" label="Label color" value={value.labelColor} onChange={(labelColor) => set({ labelColor })} />
                    </div>
                    <div>
                      <span className="mb-1.5 block text-sm font-medium">Text</span>
                      <ColorInput id="p3d-text-color" label="Text color" value={value.textColor} onChange={(textColor) => set({ textColor })} />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-3 lg:sticky lg:top-24 lg:self-start">
            <CandleViewer look={look} description={describeLook(look)} compact className="aspect-square w-full" />
            <p className="text-[0.8125rem] text-ink-soft">Live preview. Drag to turn it.</p>
            {PARTS.filter((part) => value.bindings[part.key] && (isJar || !part.jarOnly)).map((part) => {
              const name = value.bindings[part.key];
              const choice = choices.find((c) => c.name === name);
              if (!choice) return null;
              return (
                <div key={part.key}>
                  <label htmlFor={`p3d-try-${part.key}`} className="mb-1 block text-xs font-medium text-ink-soft">
                    Try “{name}”
                  </label>
                  <select id={`p3d-try-${part.key}`} className={cn(controlClass, "py-1.5")} value={previewSelection[name] ?? ""} onChange={(e) => setSample((s) => ({ ...s, [name]: e.target.value }))}>
                    {choice.values.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
            {value.showLabel && value.bindings.labelText.length ? (
              <div>
                <label htmlFor="p3d-try-text" className="mb-1 block text-xs font-medium text-ink-soft">
                  Try “{value.bindings.labelText[0]}”
                </label>
                <input
                  id="p3d-try-text"
                  className={cn(controlClass, "py-1.5")}
                  maxLength={40}
                  value={sample[value.bindings.labelText[0]] ?? ""}
                  placeholder="Type a sample"
                  onChange={(e) => setSample((s) => ({ ...s, [value.bindings.labelText[0]]: e.target.value }))}
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
