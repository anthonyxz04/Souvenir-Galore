import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guards";
import { formatMoney, toMajorString } from "@/lib/money";
import { getAllSettings } from "@/lib/settings";
import { deleteDeliveryZoneAction, moveDeliveryZoneAction } from "@/server/actions/admin/store";
import { AdminPageHeader, EmptyRow, Panel, Table, Td, Th } from "@/components/admin/admin-ui";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { DeliveryZoneDialog, PickupForm } from "@/components/admin/settings-forms";
import { Badge } from "@/components/ui/badge";
import { ArrowDownIcon, ArrowUpIcon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Delivery & pickup" };

export default async function DeliveryPage() {
  await requireStaffPage("settings:manage", "/admin/delivery");
  const [zones, settings] = await Promise.all([prisma.deliveryZone.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }] }), getAllSettings()]);
  const { commerce } = settings;
  const currency = { code: commerce.currencyCode, decimals: commerce.currencyDecimals, locale: commerce.currencyLocale };
  const d = commerce.currencyDecimals;
  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Delivery & pickup"
        description="Customers choose an area at checkout and pay its fee. Areas start switched off — set your real fees, then switch on the ones you serve."
        actions={<DeliveryZoneDialog trigger="Add delivery area" />}
      />
      <Table>
        <thead>
          <tr>
            <Th>Area</Th>
            <Th>Fee</Th>
            <Th>Free above</Th>
            <Th>Days</Th>
            <Th>Status</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {zones.length ? (
            zones.map((zone) => (
              <tr key={zone.id}>
                <Td>
                  <p className="font-medium">{zone.name}</p>
                  {zone.description ? <p className="text-xs text-ink-soft">{zone.description}</p> : null}
                </Td>
                <Td className="tabular-nums">{zone.fee === 0 ? "Free" : formatMoney(zone.fee, currency)}</Td>
                <Td className="tabular-nums">{zone.freeAboveSubtotal !== null ? formatMoney(zone.freeAboveSubtotal, currency) : "—"}</Td>
                <Td className="text-sm">{zone.minDays || zone.maxDays ? `${zone.minDays ?? "?"}–${zone.maxDays ?? "?"}` : "—"}</Td>
                <Td>
                  <Badge tone={zone.isActive ? "success" : "neutral"}>{zone.isActive ? "Delivering" : "Off"}</Badge>
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-1">
                    {(["up", "down"] as const).map((direction) => (
                      <form key={direction} action={moveDeliveryZoneAction}>
                        <input type="hidden" name="id" value={zone.id} />
                        <input type="hidden" name="direction" value={direction} />
                        <button type="submit" className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-ink/5" aria-label={`Move ${zone.name} ${direction}`}>
                          {direction === "up" ? <ArrowUpIcon size={16} /> : <ArrowDownIcon size={16} />}
                        </button>
                      </form>
                    ))}
                    <DeliveryZoneDialog
                      variant="ghost"
                      trigger="Edit"
                      zone={{
                        id: zone.id,
                        name: zone.name,
                        description: zone.description ?? "",
                        fee: toMajorString(zone.fee, d),
                        freeAboveSubtotal: zone.freeAboveSubtotal !== null ? toMajorString(zone.freeAboveSubtotal, d) : "",
                        minDays: zone.minDays !== null ? String(zone.minDays) : "",
                        maxDays: zone.maxDays !== null ? String(zone.maxDays) : "",
                        isActive: zone.isActive,
                      }}
                    />
                    <ConfirmButton action={deleteDeliveryZoneAction} fields={{ id: zone.id }} variant="ghost" label="Delete" title={`Delete ${zone.name}?`} description="Past orders keep the area name. Customers can no longer choose it." confirmLabel="Delete area" />
                  </div>
                </Td>
              </tr>
            ))
          ) : (
            <EmptyRow colSpan={6}>No delivery areas yet.</EmptyRow>
          )}
        </tbody>
      </Table>
      <Panel title="Pickup">
        <PickupForm settings={settings.pickup} />
      </Panel>
    </div>
  );
}
