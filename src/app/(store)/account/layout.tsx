import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guards";
import { getSettings } from "@/lib/settings";
import { Container } from "@/components/ui/misc";
import { AccountNav } from "@/components/account/account-nav";

export async function generateMetadata(): Promise<Metadata> {
  const store = await getSettings("store");
  return { title: { absolute: `My account | ${store.name}`, template: `%s | ${store.name}` }, robots: { index: false, follow: false } };
}
export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/account");
  return (
    <Container wide className="py-10 sm:py-14">
      <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-14">
        <div className="space-y-4">
          <div>
            <p className="font-display text-2xl text-ink">{user.name}</p>
            <p className="truncate text-sm text-ink-soft">{user.email}</p>
          </div>
          <AccountNav />
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </Container>
  );
}
