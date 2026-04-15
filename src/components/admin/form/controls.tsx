"use client";

// Shared form controls used by both /admin/review/[id] and /admin/listings/[id].
// Anything visual in those two forms should live here — so the two pages stay
// designed the same by construction rather than by copy-paste.

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";

export const inputClass =
  "w-full px-4 py-2.5 text-sm border border-neutral-200 dark:border-neutral-800 rounded-xl bg-surface placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors";

// Section divider headline. Martina serif, darker than field labels so the
// hierarchy reads clearly (section > field > value).
export function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <h3
        className="text-xl font-medium text-neutral-900 dark:text-neutral-100 shrink-0"
        style={{ fontFamily: "var(--font-martina), Georgia, serif" }}
      >
        {children}
      </h3>
      <div className="flex-1 h-px bg-neutral-100 dark:bg-neutral-800" />
    </div>
  );
}

export function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

export function SelectInput({
  value,
  onChange,
  options,
  placeholder,
  allowCustom,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  allowCustom?: boolean;
}) {
  // allowCustom swaps to an input+combobox so admins can type a brand-new
  // value (e.g. a neighborhood we haven't added yet) while still getting the
  // canonical list as typeahead suggestions.
  if (allowCustom) {
    return <DatalistInput value={value} onChange={onChange} options={options} placeholder={placeholder} />;
  }

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass + " appearance-none pr-10"}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
    </div>
  );
}

function DatalistInput({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  // Custom combobox rather than native <datalist>: the native control hides
  // its popup when the typed value doesn't match any option (so a legacy
  // "Hialeah" value that's not in MIAMI_NEIGHBORHOODS wipes out the list),
  // and Safari's support for programmatic showPicker() on datalist is spotty.
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const q = value.trim().toLowerCase();
  const exactMatch = q && options.some((o) => o.label.toLowerCase() === q);
  // When the value exactly matches an option, the admin has already picked —
  // show the full list so they can browse other choices. When they're typing
  // a partial query, filter. If the filter yields zero, fall back to the
  // full list too.
  const narrowed = q && !exactMatch ? options.filter((o) => o.label.toLowerCase().includes(q)) : [];
  const filtered = narrowed.length > 0 ? narrowed : options;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        placeholder={placeholder}
        className={inputClass + " pr-10"}
      />
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          inputRef.current?.focus();
        }}
        aria-label="Show suggestions"
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
      >
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-surface border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-lg overflow-hidden max-h-60 overflow-y-auto scrollbar-hide">
          {filtered.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className="block w-full text-left px-4 py-2 text-sm text-neutral-600 dark:text-neutral-400 hover:bg-ink-100 transition-colors"
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ChipSelect({
  options,
  labels,
  selected,
  onChange,
}: {
  options: string[];
  labels?: Record<string, string>;
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  function toggle(v: string) {
    if (selected.includes(v)) {
      onChange(selected.filter((s) => s !== v));
    } else {
      onChange([...selected, v]);
    }
  }

  function commitDraft() {
    const v = draft.trim();
    if (!v) {
      setAdding(false);
      setDraft("");
      return;
    }
    const existing = [...options, ...selected].find((o) => o.toLowerCase() === v.toLowerCase());
    const value = existing ?? v;
    if (!selected.includes(value)) onChange([...selected, value]);
    setDraft("");
    setAdding(false);
  }

  // Render any selected values that aren't in the canonical options list so
  // previously-added custom chips remain visible + deselectable.
  const extras = selected.filter((s) => !options.includes(s));
  const rendered = [...options, ...extras];

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto scrollbar-hide p-0.5">
        {rendered.map((opt) => {
          const isActive = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                isActive
                  ? "bg-black border-black text-white dark:bg-white dark:border-white dark:text-black"
                  : "bg-surface border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-500"
              }`}
            >
              {labels ? labels[opt] || opt : opt}
            </button>
          );
        })}
        {adding ? (
          <input
            autoFocus
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitDraft();
              }
              if (e.key === "Escape") {
                setDraft("");
                setAdding(false);
              }
            }}
            placeholder="Add custom…"
            className="px-2.5 py-1 text-xs rounded-full border border-dashed border-neutral-300 dark:border-neutral-600 bg-surface text-neutral-700 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-500 dark:focus:border-neutral-400 transition-colors w-32"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="px-2.5 py-1 text-xs rounded-full border border-dashed border-neutral-300 dark:border-neutral-600 text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:border-neutral-400 dark:hover:border-neutral-500 transition-colors inline-flex items-center gap-1"
          >
            <Plus size={11} /> Add custom
          </button>
        )}
      </div>
      {selected.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 mt-2 transition-colors"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
