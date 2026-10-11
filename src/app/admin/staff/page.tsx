import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guards";
import { PERMISSIONS, ROLE_LABEL, hasPermission } from "@/lib/auth/permissions";
import { setUserDisabledAction } from "@/server/actions/admin/staff";
import { AdminPageHeader, formatDateTime, Panel, Table, Td, Th } from "@/components/admin/admin-ui";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { StaffRoleForm } from "@/components/admin/staff-form";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Staff" };

const PERMISSION_LABEL: Record<string, string> = {
  "dashboard:view": "Dashboard",
  "analytics:view": "Sales figures",
  "products:manage": "Products & stock",
  "catalog:manage": "Categories & collections",
  "orders:view": "View orders",
  "orders:manage": "Update orders",
  "payments:verify": "Confirm payments & refunds",
  "customers:view": "Customers",
  "requests:manage": "Requests & messages",
  "reviews:manage": "Reviews",
  "discounts:manage": "Discounts",
  "content:manage": "Homepage & pages",
  "newsletter:manage": "Newsletter",
  "settings:manage": "Store settings & delivery",
  "payment-methods:manage": "Payment methods",
  "staff:manage": "Staff",
  "audit:view": "Activity log",
};

export default async function StaffPage() {
  const viewer = await requireStaffPage("staff:manage", "/admin/staff");
  const staff = await prisma.user.findMany({ where: { role: { in: ["STAFF", "ADMIN", "OWNER"] }, deletedAt: null }, orderBy: [{ role: "desc" }, { name: "asc" }] });
  return (
    <div className="space-y-6">
      <AdminPageHeader title="Staff" description="Give team members their own accounts — never share a password. Each person must first create an account on the store and confirm their email." />
      <Panel title="Add or change access">
        <StaffRoleForm />
      </Panel>
      <Table>
        <thead>
          <tr>
            <Th>Person</Th>
            <Th>Access</Th>
            <Th>Last sign-in</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {staff.map((member) => (
            <tr key={member.id}>
              <Td>
                <p className="font-medium">
                  {member.name} {member.id === viewer.id ? <span className="text-sm text-ink-soft">(you)</span> : null}
                </p>
                <p className="text-xs text-ink-soft">{member.email}</p>
              </Td>
              <Td className="space-x-1">
                <Badge tone={member.role === "OWNER" ? "olive" : member.role === "ADMIN" ? "info" : "neutral"}>{ROLE_LABEL[member.role]}</Badge>
                {member.disabledAt ? <Badge tone="danger">Disabled</Badge> : null}
              </Td>
              <Td className="text-sm text-ink-soft">{formatDateTime(member.lastLoginAt)}</Td>
              <Td className="text-right">
                {member.id !== viewer.id ? (
                  <ConfirmButton
                    action={setUserDisabledAction}
                    fields={{ userId: member.id, disabled: member.disabledAt ? "false" : "true" }}
                    variant="ghost"
                    label={member.disabledAt ? "Re-enable" : "Disable"}
                    title={member.disabledAt ? `Re-enable ${member.name}?` : `Disable ${member.name}?`}
                    description={member.disabledAt ? "They'll be able to sign in again." : "They're signed out immediately and can't sign in."}
                    confirmLabel={member.disabledAt ? "Re-enable" : "Disable"}
                    confirmVariant={member.disabledAt ? "primary" : "danger"}
                  />
                ) : null}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Panel title="What each role can do">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-soft">
                <th className="pb-2 font-semibold">Area</th>
                <th className="pb-2 font-semibold">Staff</th>
                <th className="pb-2 font-semibold">Administrator</th>
                <th className="pb-2 font-semibold">Owner</th>
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((permission) => (
                <tr key={permission} className="border-t border-line/60">
                  <td className="py-1.5">{PERMISSION_LABEL[permission]}</td>
                  {(["STAFF", "ADMIN", "OWNER"] as const).map((role) => (
                    <td key={role} className="py-1.5">
                      {hasPermission(role, permission) ? "Yes" : <span className="text-ink-soft">No</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
