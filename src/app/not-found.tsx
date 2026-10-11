import Link from "next/link";
import { Wordmark } from "@/components/store/logo";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <Link href="/" aria-label="Home">
        <Wordmark />
      </Link>
      <h1 className="font-display text-title">Page not found</h1>
      <p className="max-w-md text-ink-soft">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
      <Link href="/" className="inline-flex h-11 items-center rounded-full bg-olive px-5 font-medium text-white hover:bg-olive-deep">
        Go to the homepage
      </Link>
    </main>
  );
}
