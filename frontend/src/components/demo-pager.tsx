"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function DemoPager({ page, pageCount, total, onChange }: {
  page: number; pageCount: number; total: number; onChange: (next: number) => void;
}) {
  return (
    <div className="demo-pager" aria-label="Fictional record pagination">
      <span aria-live="polite">Showing page {page} of {pageCount} · {total} fictional records</span>
      <div className="action-row">
        <button type="button" className="btn" disabled={page <= 1} onClick={() => onChange(page - 1)}
          aria-label="Previous fictional records page"><ChevronLeft size={15} aria-hidden="true"/> Previous</button>
        <button type="button" className="btn" disabled={page >= pageCount} onClick={() => onChange(page + 1)}
          aria-label="Next fictional records page">Next <ChevronRight size={15} aria-hidden="true"/></button>
      </div>
    </div>
  );
}