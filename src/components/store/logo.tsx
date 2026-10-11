import { cn } from "@/lib/utils";

const SEAL_PATH =
  "M39,20 Q36.77,23.83 37.12,28.24 Q33.45,30.72 31.85,34.85 Q27.46,35.5 24.23,38.52 Q20,37.2 15.77,38.52 Q12.54,35.5 8.15,34.85 Q6.55,30.72 2.88,28.24 Q3.23,23.83 1,20 Q3.23,16.17 2.88,11.76 Q6.55,9.28 8.15,5.15 Q12.54,4.5 15.77,1.48 Q20,2.8 24.23,1.48 Q27.46,4.5 31.85,5.15 Q33.45,9.28 37.12,11.76 Q36.77,16.17 39,20 Z";

/** The wax-seal mark: a beeswax seal pressed with an olive sprig. */
export function SealMark({ className, size = 36 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} aria-hidden focusable="false">
      <path d={SEAL_PATH} fill="#c08a2d" />
      <circle cx="20" cy="20" r="13.2" fill="none" stroke="#f9f6f1" strokeOpacity=".55" strokeWidth=".8" />
      {/* olive sprig */}
      <path d="M14 26.5c3.2-2.4 6.6-6.6 12-13" stroke="#2b2724" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M17.6 22.6c-2.6-.2-4-1.6-4.3-3.6 2.4-.1 4 1.2 4.3 3.6Z" fill="#2b2724" />
      <path d="M20.6 19.2c-.6-2.5.2-4.3 2-5.4.8 2.2.1 4.2-2 5.4Z" fill="#2b2724" />
      <path d="M21.2 18.6c2.4-1 4.4-.6 5.6 1-2.1 1.2-4.2.8-5.6-1Z" fill="#2b2724" />
      <path d="M17.9 22.3c1.8-1.8 3.8-2.1 5.5-1.1-1.5 1.7-3.6 2.2-5.5 1.1Z" fill="#2b2724" />
    </svg>
  );
}

export function Wordmark({ name = "Souvenir Galore", className }: { name?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <SealMark size={34} />
      <span className="font-display text-[1.3125rem] leading-none tracking-[0.01em] text-ink sm:text-[1.4375rem]">{name}</span>
    </span>
  );
}
