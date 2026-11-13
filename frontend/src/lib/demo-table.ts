// P3.11 deterministic, immutable sorting and pagination for fictional browser tables.
export type SortDirection = "asc" | "desc";

export function sortDemoRows<T>(
  rows: readonly T[],
  value: (row: T) => string,
  direction: SortDirection = "asc",
): T[] {
  const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });
  return rows.map((row, index) => ({ row, index })).sort((a, b) => {
    const compared = collator.compare(value(a.row), value(b.row));
    return (direction === "asc" ? compared : -compared) || a.index - b.index;
  }).map(({ row }) => row);
}

export function paginateDemoRows<T>(rows: readonly T[], requestedPage: number, pageSize = 5) {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 25) {
    throw new RangeError("Demo page size must be 1-25");
  }
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Number.isSafeInteger(requestedPage)
    ? Math.max(1, Math.min(requestedPage, pageCount)) : 1;
  return {
    rows: rows.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageCount,
    total: rows.length,
    hasPrevious: page > 1,
    hasNext: page < pageCount,
  };
}