"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

type Option = { value: string; label: string };

export default function MonthFilter({
  options,
  selected,
}: {
  options: Option[];
  selected: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mes", value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      value={selected}
      onChange={(e) => handleChange(e.target.value)}
      className="px-3 py-2 rounded-md border border-line text-sm bg-white text-ink"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
