
import React from 'react';

interface PaginationProps {
  page: number;              // текущая страница, с 1
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

// Показываем не все номера, а окно вокруг текущей страницы с многоточиями,
// иначе при сотне страниц панель сама становится длинным списком.
const buildPages = (current: number, total: number): (number | '…')[] => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '…')[] = [1];
  const from = Math.max(2, current - 1);
  const to = Math.min(total - 1, current + 1);
  if (from > 2) pages.push('…');
  for (let i = from; i <= to; i++) pages.push(i);
  if (to < total - 1) pages.push('…');
  pages.push(total);
  return pages;
};

const Pagination: React.FC<PaginationProps> = ({
  page, pageSize, totalItems, onPageChange, onPageSizeChange, pageSizeOptions = [20, 50, 100]
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems === 0) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-100">
      <div className="text-[11px] font-semibold text-slate-400">
        {first}–{last} из {totalItems}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Назад"
          >
            <i className="fas fa-chevron-left text-[10px]"></i>
          </button>

          {buildPages(page, totalPages).map((p, i) =>
            p === '…' ? (
              <span key={`gap-${i}`} className="w-8 h-8 flex items-center justify-center text-slate-300 text-xs">…</span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`min-w-8 h-8 px-2 rounded-lg text-xs font-semibold transition-colors ${
                  p === page ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {p}
              </button>
            )
          )}

          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Вперёд"
          >
            <i className="fas fa-chevron-right text-[10px]"></i>
          </button>
        </div>
      )}

      {onPageSizeChange && (
        <select
          value={pageSize}
          onChange={e => onPageSizeChange(Number(e.target.value))}
          className="bg-slate-50 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-slate-500 outline-none border border-transparent focus:border-blue-500"
        >
          {pageSizeOptions.map(n => <option key={n} value={n}>по {n}</option>)}
        </select>
      )}
    </div>
  );
};

export default Pagination;
