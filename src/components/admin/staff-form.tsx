"use client";

import { setUserRoleAction } from "@/server/actions/admin/staff";
import { InputField, SelectField } from "@/components/ui/field";
import { AdminForm } from "./admin-form";

export function StaffRoleForm() {
  return (
    <AdminForm action={setUserRoleAction} submitLabel="Update access" resetOnSuccess>
      {(state) => (
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
          <InputField name="email" label="Account email" type="email" required defaultValue={state.values?.email} error={state.fieldErrors?.email} />
          <SelectField
            name="role"
            label="Access"
            defaultValue={state.values?.role ?? "STAFF"}
            options={[
              { value: "STAFF", label: "Staff (orders & products)" },
              { value: "ADMIN", label: "Administrator (everything except staff)" },
              { value: "OWNER", label: "Owner (full access)" },
              { value: "CUSTOMER", label: "Remove dashboard access" },
            ]}
          />
        </div>
      )}
    </AdminForm>
  );
}
