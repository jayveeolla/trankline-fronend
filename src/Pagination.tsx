import { useEffect, useMemo, useState } from 'react'

export function usePagination<T>(items: T[], pageSize = 10) {
  const [page, setPage] = useState(0)
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  useEffect(() => { setPage((current) => Math.min(current, pageCount - 1)) }, [pageCount])
  const visibleItems = useMemo(() => items.slice(page * pageSize, (page + 1) * pageSize), [items, page, pageSize])
  return { page, setPage, pageCount, visibleItems, total: items.length, pageSize }
}

export function PaginationControls({ page, pageCount, total, pageSize, setPage }: { page: number; pageCount: number; total: number; pageSize: number; setPage: (page: number) => void }) {
  if (total <= pageSize) return null
  const first = page * pageSize + 1
  const last = Math.min((page + 1) * pageSize, total)
  return <div className="pagination-bar"><span>Showing {first}–{last} of {total}</span><div><button className="pagination-button" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><strong>Page {page + 1} of {pageCount}</strong><button className="pagination-button" disabled={page >= pageCount - 1} onClick={() => setPage(page + 1)}>Next</button></div></div>
}
