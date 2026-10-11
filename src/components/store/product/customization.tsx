"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Selection } from "@/lib/candle3d/config";

type Customization = { selection: Selection; setSelection: (selection: Selection) => void };

const CustomizationContext = createContext<Customization | null>(null);

/**
 * Shares what the customer has picked and typed in the purchase form with the
 * 3D preview next to it. The purchase form stays the single source of truth:
 * it is what's submitted to the cart.
 */
export function CustomizationProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<Selection>({});
  const value = useMemo(() => ({ selection, setSelection }), [selection]);
  return <CustomizationContext.Provider value={value}>{children}</CustomizationContext.Provider>;
}

/** Null outside a provider (e.g. quick views), so callers can skip reporting. */
export function useCustomization(): Customization | null {
  return useContext(CustomizationContext);
}
