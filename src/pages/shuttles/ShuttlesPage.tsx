import { useEffect, useMemo, useState } from 'react'
import { BusFront, Plus, Search } from 'lucide-react'
import { api, type ApiRoute, type ApiShuttle } from '../../api'
import { PaginationControls, usePagination } from '../../Pagination'

export default function ShuttlesPage({ shuttles, routes, notify, onChanged, onOpenHistory, navigate }: { shuttles: { id: string }[]; routes: ApiRoute[]; notify: (message: string) => void; onChanged: () => void; onOpenHistory: (shuttleId: string) => void; navigate: (path: string) => void }) {
  const [databaseShuttles, setDatabaseShuttles] = useState<ApiShuttle[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  useEffect(() => {
    let active = true
    api.shuttles().then((result) => { if (active) setDatabaseShuttles(result.shuttles) }).catch(() => undefined)
    return () => { active = false }
  }, [shuttles])
  const filteredShuttles = useMemo(() => databaseShuttles.filter((shuttle) => {
    const query = search.trim().toLowerCase()
    const matchesSearch = !query || [shuttle.id, shuttle.bus_number, shuttle.vehicle_name, shuttle.plate_number, shuttle.route, shuttle.driver].filter(Boolean).some((value) => String(value).toLowerCase().includes(query))
    return matchesSearch && (statusFilter === 'ALL' || shuttle.status === statusFilter)
  }), [databaseShuttles, search, statusFilter])
  const pagination = usePagination(filteredShuttles, 8)
  useEffect(() => {
    const list = Array.from(document.querySelectorAll<HTMLElement>('.crud-page .crud-list')).find((candidate) => candidate.querySelectorAll('.crud-row').length === pagination.visibleItems.length)
    if (!list) return
    const rows = Array.from(list.querySelectorAll<HTMLElement>('.crud-row'))
    const handlers = rows.map((row, index) => {
      row.classList.add('shuttle-history-row')
      const handler = (event: MouseEvent) => {
        if ((event.target as HTMLElement).closest('button')) return
        const shuttle = pagination.visibleItems[index]
        if (shuttle) onOpenHistory(shuttle.id)
      }
      row.addEventListener('click', handler)
      return handler
    })
    return () => rows.forEach((row, index) => row.removeEventListener('click', handlers[index]))
  }, [onOpenHistory, pagination.visibleItems])

  return <div className="crud-page"><div className="crud-toolbar"><div><h3>Shuttles in database</h3><span>{search || statusFilter !== 'ALL' ? `${filteredShuttles.length} matching vehicles` : `${shuttles.length} registered vehicles`} · incoming route setup</span></div><div className="crud-filters"><label className="crud-search"><Search size={15} /><input value={search} onChange={(event) => { setSearch(event.target.value); pagination.setPage(0) }} placeholder="Search shuttles..." aria-label="Search shuttles" /></label><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); pagination.setPage(0) }} aria-label="Filter shuttles by status"><option value="ALL">All status</option><option value="LIVE">Live</option><option value="READY">Ready</option><option value="OFFLINE">Offline</option><option value="MAINTENANCE">Maintenance</option></select></div><button className="primary-button compact" onClick={() => navigate('/shuttles/add')}><Plus size={14} /> Add shuttle</button></div><div className="crud-list">{pagination.visibleItems.length ? pagination.visibleItems.map((shuttle) => <div className="crud-row" key={shuttle.id}><div className="resource-icon green"><BusFront size={17} /></div><div className="crud-main"><strong>{shuttle.id}</strong><span>{shuttle.route} · {shuttle.driver}</span></div><span className={`setting-status ${shuttle.status === 'LIVE' ? 'live' : ''}`}><i />{shuttle.status}</span><button className="crud-action" onClick={() => navigate(`/shuttles/${encodeURIComponent(shuttle.id)}/edit`)}>Edit route &amp; map</button><button className="crud-action danger-text" onClick={async () => { if (!window.confirm(`Deactivate ${shuttle.id}?`)) return; try { await api.deleteShuttle(shuttle.id); notify('Shuttle deactivated in database'); onChanged() } catch (error) { notify(error instanceof Error ? error.message : 'Could not deactivate shuttle') } }}>Deactivate</button></div>) : <div className="crud-empty">No shuttles match your filters.</div>}</div><PaginationControls {...pagination} setPage={pagination.setPage} /></div>
}
