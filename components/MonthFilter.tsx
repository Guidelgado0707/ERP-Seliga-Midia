"use client";

import { useRouter } from "next/navigation";

type Option = { value: string; label: string };

export default function MonthFilter({
  options,
  selected,
}: {
  options: Option[];
  selected: string;
}) {
  const router = useRouter();

  return (
    <select
      value={selected}
      onChange={(e) => router.push(`/dashboard?mes=${e.target.value}`)}
      className="px-3 py-2 rounded-md border border-line text-sm bg-white text-ink capitalize"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="capitalize">
          {o.label}
        </option>
      ))}
    </select>
  );
}
