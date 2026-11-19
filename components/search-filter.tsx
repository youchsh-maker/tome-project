"use client";

import { useState } from "react";

const SIZES = [
  { value: "", label: "Any" },
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];
const MINS = [1, 2, 3, 5];

/** Size and minimum-free-count choices submitted with the search form (form id "search"). */
export function SearchFilter({ size, min }: { size: string; min: number }) {
  const [current, setCurrent] = useState({ size, min });
  const sizeLabel = SIZES.find((s) => s.value === current.size && s.value)?.label;
  const what = `${sizeLabel ? `${sizeLabel} ` : ""}compartment${current.min > 1 ? "s" : ""}`;

  return (
    <fieldset className="-mt-2 flex flex-col gap-2 text-sm">
      <legend className="sr-only">Filter lockers</legend>
      <Segment
        label="Size"
        name="size"
        options={SIZES}
        value={current.size}
        onChange={(v) => setCurrent((c) => ({ ...c, size: v }))}
      />
      <Segment
        label="Free at least"
        name="min"
        options={MINS.map((n) => ({ value: String(n), label: String(n) }))}
        value={String(current.min)}
        onChange={(v) => setCurrent((c) => ({ ...c, min: Number(v) }))}
      />
      <p className="text-xs text-muted-foreground">
        Shows lockers with {current.min > 1 ? `${current.min} or more free ${what}` : `a free ${what}`}
      </p>
    </fieldset>
  );
}

function Segment({
  label,
  name,
  options,
  value,
  onChange,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3" role="radiogroup" aria-label={label}>
      <span className="w-24 text-muted-foreground">{label}</span>
      <div className="inline-flex overflow-hidden rounded-4xl border">
        {options.map((o) => (
          <label
            key={o.value}
            className="cursor-pointer border-l px-3 py-1.5 first:border-l-0 has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring"
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              form="search"
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
    </div>
  );
}
