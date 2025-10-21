"use client";

import { useEffect, useState } from "react";

export function PersonaNameInline({
  value,
  onChange,
}: {
  value?: string;
  onChange: (v?: string) => void;
}) {
  const [name, setName] = useState(value ?? "");

  // Keep parent in sync
  useEffect(() => {
    setName(value ?? "");
  }, [value]);

  return (
    <div className="mx-auto mb-2 w-full max-w-4xl px-2 md:px-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">
          Persona (for personalization/logs; optional):
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Alex"
          className="h-8 w-48 rounded border bg-background px-2"
          maxLength={64}
        />
        <button
          type="button"
          onClick={() => onChange(name.trim() || undefined)}
          className="h-8 rounded border px-3"
          title="Apply"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
