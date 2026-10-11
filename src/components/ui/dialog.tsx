"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CloseIcon } from "./icons";

/**
 * Accessible dialogs built on Radix (focus trap, Escape to close, scroll lock,
 * aria-modal). `side` turns the dialog into a sheet that slides from an edge.
 */

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

type ContentProps = {
  title: string;
  description?: string;
  hideTitle?: boolean;
  side?: "center" | "left" | "right" | "bottom";
  className?: string;
  children: ReactNode;
};

export function DialogContent({ title, description, hideTitle, side = "center", className, children }: ContentProps) {
  const position = {
    center:
      "left-1/2 top-1/2 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl max-h-[calc(100dvh-2rem)] data-[state=open]:animate-[dialog-in_180ms_ease-out]",
    left: "inset-y-0 left-0 h-dvh w-[min(88vw,380px)] data-[state=open]:animate-[sheet-left_220ms_ease-out]",
    right: "inset-y-0 right-0 h-dvh w-[min(92vw,440px)] data-[state=open]:animate-[sheet-right_220ms_ease-out]",
    bottom: "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-2xl data-[state=open]:animate-[sheet-up_220ms_ease-out]",
  }[side];

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_150ms_ease-out]" />
      <DialogPrimitive.Content
        className={cn("fixed z-50 flex flex-col overflow-hidden bg-plaster shadow-lift focus:outline-none", position, className)}
      >
        <div className={cn("flex items-start justify-between gap-4 px-5 pt-5", hideTitle && "sr-only")}>
          <div className="space-y-1">
            <DialogPrimitive.Title className="font-display text-[1.375rem] leading-tight text-ink">{title}</DialogPrimitive.Title>
            {description ? <DialogPrimitive.Description className="text-sm text-ink-soft">{description}</DialogPrimitive.Description> : null}
          </div>
        </div>
        {!description ? <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description> : null}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4">{children}</div>
        <DialogPrimitive.Close
          className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-soft hover:bg-ink/5 hover:text-ink"
          aria-label="Close"
        >
          <CloseIcon size={20} />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
