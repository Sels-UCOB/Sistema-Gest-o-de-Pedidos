interface PageNavProps {
  page: number;        // 0-indexed
  pageSize: number;
  total?: number;      // known total (client-side pagination) → mostra "Página X de N"
  hasMore?: boolean;   // server-side: desabilita "próxima" quando false
  onChange: (page: number) => void;
  loading?: boolean;
  className?: string;
}

export function PageNav({ page, pageSize, total, hasMore, onChange, loading, className }: PageNavProps) {
  const totalPages = total !== undefined ? Math.ceil(total / pageSize) : null;
  const hasPrev = page > 0;
  const hasNext = totalPages !== null ? page < totalPages - 1 : (hasMore ?? false);

  if (totalPages === 1 || (totalPages === null && page === 0 && !hasMore)) return null;
  if (total === 0) return null;

  const btnClass =
    "px-3 py-1.5 rounded-lg text-sm border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors";

  return (
    <div className={`flex items-center justify-center gap-4 py-4 border-t border-slate-800 ${className ?? ""}`}>
      <button className={btnClass} disabled={!hasPrev || loading} onClick={() => onChange(page - 1)}>
        ‹ Anterior
      </button>
      <span className="text-sm text-slate-400 min-w-[110px] text-center">
        {loading ? "Carregando..." : totalPages ? `Página ${page + 1} de ${totalPages}` : `Página ${page + 1}`}
      </span>
      <button className={btnClass} disabled={!hasNext || loading} onClick={() => onChange(page + 1)}>
        Próxima ›
      </button>
    </div>
  );
}
