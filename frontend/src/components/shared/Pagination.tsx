"use client";
export default function Pagination({
  page,
  setPage,
  total,
  limit,
  setLimit,
}: {
  page: number;
  setPage: (n: number) => void;
  total: number;
  limit: number;
  setLimit: (n: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  const current = Math.min(page, pages);
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 pt-4 text-sm text-slate-500 [&_label]:flex [&_label]:items-center [&_label]:gap-2 [&_select]:rounded-lg [&_select]:border [&_select]:p-2 [&_button]:rounded-lg [&_button]:border [&_button]:px-3 [&_button]:py-2 [&_button:disabled]:opacity-40">
      <span>
        Showing {total ? (current - 1) * limit + 1 : 0}–
        {Math.min(current * limit, total)} of {total}
      </span>
      <label>
        Rows{" "}
        <select
          value={limit}
          onChange={(e) => {
            setLimit(Number(e.target.value));
            setPage(1);
          }}
        >
          {[5, 10, 20, 50].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </label>
      <button disabled={current <= 1} onClick={() => setPage(1)}>
        «
      </button>
      <button disabled={current <= 1} onClick={() => setPage(current - 1)}>
        ‹
      </button>
      <span>
        {current} / {pages}
      </span>
      <button disabled={current >= pages} onClick={() => setPage(current + 1)}>
        ›
      </button>
      <button disabled={current >= pages} onClick={() => setPage(pages)}>
        »
      </button>
    </div>
  );
}
