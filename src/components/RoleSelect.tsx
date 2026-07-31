"use client";

import { useTransition } from "react";
import { updateUserRole } from "@/app/(app)/settings/actions";
import { ROLE_LABELS } from "@/lib/constants";
import type { UserRole } from "@/types/database";

export function RoleSelect({ profileId, role }: { profileId: string; role: UserRole }) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      disabled={isPending}
      defaultValue={role}
      onChange={(e) => startTransition(() => updateUserRole(profileId, e.target.value as UserRole))}
      className="input-base px-2 py-1 text-xs"
    >
      {Object.entries(ROLE_LABELS).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}
