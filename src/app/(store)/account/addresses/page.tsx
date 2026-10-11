import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { deleteAddressAction, setDefaultAddressAction } from "@/server/actions/account";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { AddressDialog } from "@/components/account/account-forms";

export const metadata: Metadata = { title: "Addresses" };

export default async function AddressesPage() {
  const user = await requireUser("/account/addresses");
  const [addresses, zones] = await Promise.all([
    prisma.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] }),
    prisma.deliveryZone.findMany({ where: { isActive: true }, orderBy: [{ position: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-[2.25rem] leading-tight sm:text-title">Addresses</h1>
        <AddressDialog zones={zones} trigger="Add an address" />
      </div>
      {addresses.length ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {addresses.map((address) => (
            <li key={address.id} className="flex flex-col justify-between gap-4 rounded-2xl bg-plaster p-5">
              <div className="space-y-1 text-[0.9375rem]">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{address.label || address.recipientName}</p>
                  {address.isDefault ? <Badge tone="success">Default</Badge> : null}
                </div>
                <address className="not-italic leading-relaxed text-ink-soft">
                  {address.recipientName}
                  <br />
                  {address.line1}
                  {address.line2 ? `, ${address.line2}` : ""}
                  <br />
                  {[address.city, address.region].filter(Boolean).join(", ")}
                  <br />
                  {address.phone}
                </address>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <AddressDialog address={address} zones={zones} trigger="Edit" />
                {!address.isDefault ? (
                  <form action={setDefaultAddressAction}>
                    <input type="hidden" name="addressId" value={address.id} />
                    <button type="submit" className="h-9 rounded-full px-4 text-sm hover:bg-ink/5">
                      Make default
                    </button>
                  </form>
                ) : null}
                <form action={deleteAddressAction}>
                  <input type="hidden" name="addressId" value={address.id} />
                  <button type="submit" className="h-9 rounded-full px-4 text-sm text-wine hover:bg-wine-soft">
                    Delete
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No saved addresses">Save an address here or at checkout to order faster next time.</EmptyState>
      )}
    </div>
  );
}
