"use client";

import { useState, useRef } from "react";
import { GLOSSARY } from "@/lib/glossary";

interface Props {
  id: string;
  children: React.ReactNode;
}

export function GlossaryChip({ id, children }: Props) {
  const entry = GLOSSARY[id];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  if (!entry) return <span>{children}</span>;

  return (
    <span className="relative inline-block">
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        className="border-b border-dashed border-ink-soft text-inherit cursor-help focus:outline-none focus-visible:outline-2 focus-visible:outline-brand"
        aria-describedby={`glossary-${id}`}
      >
        {children}
      </button>
      {open && (
        <span
          id={`glossary-${id}`}
          role="tooltip"
          className="absolute left-0 bottom-full mb-2 z-50 w-72 rounded-lg border border-border bg-white p-3 shadow-lg text-sm text-ink leading-relaxed"
        >
          <span className="font-semibold text-ink block mb-1">{entry.term}</span>
          {entry.definition}
        </span>
      )}
    </span>
  );
}
