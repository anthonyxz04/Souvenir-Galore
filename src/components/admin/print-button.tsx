"use client";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="h-9 rounded-full px-4 text-sm ring-1 ring-ink/20 hover:bg-plaster print:hidden">
      Print
    </button>
  );
}
