"use client";

import { type ReactNode, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// A dense table for module pages: a filter box, and cells that are edited in place.

export type Column<T> = {
  key: string;
  header: string;
  /** What the cell shows. */
  cell: (row: T) => ReactNode;
  /** Text the filter looks at; default: nothing of this column. */
  text?: (row: T) => string;
  align?: "left" | "right";
  /** Makes the cell editable in place: its current value and what to do with the new one. */
  edit?: {
    value: (row: T) => string;
    type?: "text" | "number";
    onCommit: (row: T, value: string) => void;
    label: (row: T) => string;
  };
};

export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  filterLabel,
  empty = "Kayıt yok.",
}: {
  /** Names the table for assistive technology. */
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Shows a filter box with this label; without it the table is not filterable. */
  filterLabel?: string;
  empty?: string;
}) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("tr-TR");
    if (!needle) return rows;
    return rows.filter((row) =>
      columns.some((column) => column.text?.(row).toLocaleLowerCase("tr-TR").includes(needle)),
    );
  }, [rows, columns, query]);

  return (
    <div className="flex flex-col gap-3">
      {filterLabel ? (
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label={filterLabel}
          placeholder={filterLabel}
          className="h-11 max-w-xs md:h-9"
        />
      ) : null}
      <div className="border-border overflow-x-auto rounded-xl border">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-border border-b">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    "text-muted-foreground px-3 py-2 text-xs font-medium whitespace-nowrap",
                    column.align === "right" ? "text-right" : "text-left",
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-muted-foreground px-3 py-6 text-center"
                >
                  {empty}
                </td>
              </tr>
            ) : (
              visible.map((row) => (
                <tr key={rowKey(row)} className="border-border border-b last:border-b-0">
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        "px-3 py-1.5 tabular-nums",
                        column.align === "right" ? "text-right" : "text-left",
                      )}
                    >
                      {column.edit ? (
                        <EditableCell
                          key={column.edit.value(row)}
                          initial={column.edit.value(row)}
                          type={column.edit.type ?? "text"}
                          label={column.edit.label(row)}
                          align={column.align}
                          onCommit={(value) => column.edit!.onCommit(row, value)}
                        />
                      ) : (
                        column.cell(row)
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** A cell that is its own input: Enter or leaving the cell saves, Escape puts the old value back. */
function EditableCell({
  initial,
  type,
  label,
  align,
  onCommit,
}: {
  initial: string;
  type: "text" | "number";
  label: string;
  align?: "left" | "right";
  onCommit: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  const commit = () => {
    if (value !== initial) onCommit(value);
  };
  return (
    <input
      type={type}
      inputMode={type === "number" ? "numeric" : undefined}
      value={value}
      aria-label={label}
      onChange={(event) => setValue(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setValue(initial);
          // Leave the cell without saving what was typed.
          requestAnimationFrame(() => (event.target as HTMLInputElement).blur());
        }
      }}
      className={cn(
        "hover:border-border focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full min-w-16 rounded-md border border-transparent bg-transparent px-2 outline-none focus-visible:ring-3 md:h-8",
        align === "right" && "text-right",
      )}
    />
  );
}
