import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { ProfileForm } from "@/components/account/account-forms";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const sessionUser = await requireUser("/account/profile");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: sessionUser.id }, select: { name: true, phone: true, marketingOptIn: true, email: true } });
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="font-display text-[2.25rem] leading-tight sm:text-title">Profile</h1>
        <p className="text-ink-soft">Your email address is {user.email}. To change it, contact us.</p>
      </div>
      <ProfileForm name={user.name} phone={user.phone} marketingOptIn={user.marketingOptIn} />
    </div>
  );
}
