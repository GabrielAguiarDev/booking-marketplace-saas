"use client";

import { useRouter } from "next/navigation";

import type { MembershipOption } from "./model";

export function EstablishmentPicker({
  establishments,
  value,
}: {
  establishments: MembershipOption[];
  value: string;
}) {
  const router = useRouter();
  if (establishments.length < 2) return null;
  return (
    <label className="establishment-picker">
      <span>Loja</span>
      <select
        onChange={(event) =>
          router.replace(`/?establishment=${encodeURIComponent(event.target.value)}`)
        }
        value={value}
      >
        {establishments.map((item) => (
          <option key={item.id} value={item.id}>{item.name}</option>
        ))}
      </select>
    </label>
  );
}
