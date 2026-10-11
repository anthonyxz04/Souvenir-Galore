import { cn } from "@/lib/utils";
import { AlertIcon, CheckIcon, InfoIcon } from "./icons";

/** Status message for forms; announced to screen readers. */
export function FormMessage({ state, className }: { state: { status: string; message?: string }; className?: string }) {
  if (!state.message || state.status === "idle") return null;
  const isError = state.status === "error";
  return (
    <div
      role={isError ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-xl px-4 py-3 text-[0.9375rem] leading-snug",
        isError ? "bg-wine-soft text-wine" : "bg-olive-soft text-olive",
        className,
      )}
    >
      {isError ? <AlertIcon className="mt-0.5 shrink-0" size={18} /> : <CheckIcon className="mt-0.5 shrink-0" size={18} />}
      <span>{state.message}</span>
    </div>
  );
}

export function Notice({ tone = "info", title, children, className }: { tone?: "info" | "warning" | "danger" | "success"; title?: string; children: React.ReactNode; className?: string }) {
  const styles = {
    info: "bg-plaster ring-1 ring-line text-ink",
    warning: "bg-wax-soft text-ink",
    danger: "bg-wine-soft text-wine",
    success: "bg-olive-soft text-olive",
  }[tone];
  return (
    <div className={cn("flex gap-3 rounded-xl px-4 py-3.5 text-[0.9375rem] leading-relaxed", styles, className)}>
      {tone === "danger" || tone === "warning" ? <AlertIcon className="mt-1 shrink-0" size={18} /> : <InfoIcon className="mt-1 shrink-0" size={18} />}
      <div className="space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div>{children}</div>
      </div>
    </div>
  );
}
