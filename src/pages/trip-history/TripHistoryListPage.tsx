import { useEffect, useMemo, useState } from 'react'
import { BusFront, CheckCircle2, ChevronDown, CircleX, Clock3, Download, MoreVertical, Route, Search, Users, X } from 'lucide-react'
import { api, type ApiTrip } from '../../api'

type TripHistoryListPageProps = {
  trips: ApiTrip[]
  allTrips: ApiTrip[]
  notify: (message: string) => void
  onSelectTrip: (tripId: number) => void
  shuttleId?: string | null
  onClearShuttle?: () => void
}

const activeStatuses = new Set(['NOT_STARTED', 'EN_ROUTE', 'APPROACHING_STOP', 'AT_PICKUP_POINT', 'HEADING_TO_TDK', 'PAUSED'])

function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function formatDuration(start?: string | null, end?: string | null) {
  if (!start || !end) return '—'
  const minutes = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000))
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`
}

function statusClass(status: string) {
  if (status === 'COMPLETED') return 'completed'
  if (status === 'CANCELLED') return 'cancelled'
  if (activeStatuses.has(status)) return 'in-progress'
  return 'neutral'
}

function downloadCsv(rows: ApiTrip[]) {
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const header = ['Trip ID', 'Shuttle', 'Route', 'Driver', 'Start time', 'End time', 'Duration', 'Type', 'Status']
  const body = rows.map((trip) => [trip.trip_code, trip.shuttle_id, trip.route_name || 'Incoming route', trip.driver_name || '', trip.started_at, trip.ended_at || '', formatDuration(trip.started_at, trip.ended_at), trip.trip_mode || 'REAL', trip.status])
  const csv = [header, ...body].map((line) => line.map(escape).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'trackline-trip-history.csv'
  link.click()
  URL.revokeObjectURL(url)
}

export default function TripHistoryListPage({ trips, allTrips, notify, onSelectTrip, shuttleId, onClearShuttle }: TripHistoryListPageProps) {
  const [activeTrips, setActiveTrips] = useState<ApiTrip[]>([])
  const [endingId, setEndingId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('ALL')
  const [shuttle, setShuttle] = useState(shuttleId || 'ALL')
  const [route, setRoute] = useState('ALL')
  const [driver, setDriver] = useState('ALL')
  const [type, setType] = useState('ALL')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 7
  const hasActiveFilters = Boolean(search.trim() || status !== 'ALL' || (!shuttleId && shuttle !== 'ALL') || route !== 'ALL' || driver !== 'ALL' || type !== 'ALL' || fromDate || toDate)

  const clearFilters = () => {
    setSearch('')
    setStatus('ALL')
    setShuttle(shuttleId || 'ALL')
    setRoute('ALL')
    setDriver('ALL')
    setType('ALL')
    setFromDate('')
    setToDate('')
    setPage(1)
  }

  useEffect(() => {
    setShuttle(shuttleId || 'ALL')
  }, [shuttleId])

  const loadActiveTrips = async () => {
    try {
      const result = await api.activeTrips()
      setActiveTrips(result.trips)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not load active trips')
    }
  }

  useEffect(() => { void loadActiveTrips() }, [])

  const options = useMemo(() => ({
    shuttles: Array.from(new Set(allTrips.map((trip) => trip.shuttle_id).filter(Boolean))),
    routes: Array.from(new Set(allTrips.map((trip) => trip.route_name || 'Incoming route'))),
    drivers: Array.from(new Set(allTrips.map((trip) => trip.driver_name || 'Unassigned driver'))),
    types: Array.from(new Set(allTrips.map((trip) => trip.trip_mode || 'REAL'))),
  }), [allTrips])

  const filteredTrips = useMemo(() => {
    const query = search.trim().toLowerCase()
    return trips.filter((trip) => {
      const routeName = trip.route_name || 'Incoming route'
      const driverName = trip.driver_name || 'Unassigned driver'
      const haystack = `${trip.trip_code} ${trip.shuttle_id} ${routeName} ${driverName}`.toLowerCase()
      const tripDay = trip.started_at.slice(0, 10)
      return (!query || haystack.includes(query)) &&
        (status === 'ALL' || trip.status === status) &&
        (shuttle === 'ALL' || trip.shuttle_id === shuttle) &&
        (route === 'ALL' || routeName === route) &&
        (driver === 'ALL' || driverName === driver) &&
        (type === 'ALL' || (trip.trip_mode || 'REAL') === type) &&
        (!fromDate || tripDay >= fromDate) &&
        (!toDate || tripDay <= toDate)
    })
  }, [driver, fromDate, route, search, shuttle, status, toDate, trips, type])

  useEffect(() => { setPage(1) }, [driver, fromDate, route, search, shuttle, status, toDate, type])

  const totalPages = Math.max(1, Math.ceil(filteredTrips.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageRows = filteredTrips.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const summaryTrips = shuttle === 'ALL' ? allTrips : allTrips.filter((trip) => trip.shuttle_id === shuttle)
  const completed = summaryTrips.filter((trip) => trip.status === 'COMPLETED').length
  const cancelled = summaryTrips.filter((trip) => trip.status === 'CANCELLED').length
  const inProgress = summaryTrips.filter((trip) => activeStatuses.has(trip.status)).length
  const visibleActiveTrips = shuttleId ? activeTrips.filter((trip) => trip.shuttle_id === shuttleId) : activeTrips

  const endTrip = async (trip: ApiTrip) => {
    const reason = window.prompt(`Reason for ending ${trip.trip_code || trip.shuttle_id}:`, 'Admin ended active trip')?.trim()
    if (!reason) return
    setEndingId(trip.id)
    try {
      await api.endTrip(trip.id, reason)
      notify(`${trip.shuttle_id} ended and is ready for a new trip`)
      await loadActiveTrips()
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not end active trip')
    } finally {
      setEndingId(null)
    }
  }

  return <section className="trip-history-v3">
    <div className="trip-history-v3-kpis">
      <div><span className="trip-history-v3-icon blue"><BusFront size={20} /></span><span>Total trips<strong>{summaryTrips.length}</strong><small>{shuttle === 'ALL' ? 'All recorded journeys' : `${shuttle} journeys`}</small></span></div>
      <div><span className="trip-history-v3-icon green"><CheckCircle2 size={20} /></span><span>Completed<strong>{completed}</strong><small>Successfully finished</small></span></div>
      <div><span className="trip-history-v3-icon red"><CircleX size={20} /></span><span>Cancelled<strong>{cancelled}</strong><small>Cancelled trips</small></span></div>
      <div><span className="trip-history-v3-icon amber"><Clock3 size={20} /></span><span>In progress<strong>{inProgress}</strong><small>Currently active</small></span></div>
      <div><span className="trip-history-v3-icon slate"><Route size={20} /></span><span>Total distance<strong>—</strong><small>GPS summary data</small></span></div>
      <div><span className="trip-history-v3-icon violet"><Users size={20} /></span><span>Total passengers<strong>—</strong><small>Boarding data</small></span></div>
    </div>

    {visibleActiveTrips.length > 0 && <div className="trip-history-v3-active">
      <div className="trip-history-v3-active-heading"><div><span className="eyebrow small">ACTIVE TRIPS</span><h3>End an active trip</h3><p>Use this recovery action when a trip was left running and you need to start the shuttle again.</p></div><span className="trip-history-v3-live"><i /> {visibleActiveTrips.length} active trip{visibleActiveTrips.length > 1 ? 's' : ''}</span></div>
      {visibleActiveTrips.map((trip) => <div className="trip-history-v3-active-row" key={trip.id}><span className="trip-history-v3-bus"><BusFront size={20} /></span><span><strong>{trip.trip_code || `Trip ${trip.id}`}</strong><small>{trip.shuttle_id} <b>·</b> {trip.route_name || 'Incoming route'} <b>·</b> Started {formatTime(trip.started_at)}</small></span><span className="trip-history-v3-active-meta"><small>Driver</small><strong>{trip.driver_name || 'Unassigned'}</strong></span><span className="trip-history-v3-active-meta"><small>Duration</small><strong>{formatDuration(trip.started_at, new Date().toISOString())}</strong></span><button className="secondary-button danger compact" disabled={endingId === trip.id} onClick={() => void endTrip(trip)}>{endingId === trip.id ? 'Ending…' : 'End trip'}</button></div>)}
    </div>}

    <div className="trip-history-v3-card">
      <nav className="trip-history-v3-tabs"><button className="active">Trip History</button>
      {/* <button onClick={() => notify('GPS summaries are available when you open a trip')}>GPS Summaries</button> */}
      </nav>
      <div className="trip-history-v3-toolbar">
        <label className="trip-history-v3-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search trip ID, shuttle, driver or route…" /></label>
        <label className="trip-history-v3-date"><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /><span>–</span><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
        <select value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">All Status</option>{Array.from(new Set(allTrips.map((trip) => trip.status))).map((value) => <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>)}</select>
        <select value={shuttle} onChange={(event) => setShuttle(event.target.value)} disabled={Boolean(shuttleId)}><option value="ALL">All Shuttles</option>{options.shuttles.map((value) => <option key={value} value={value}>{value}</option>)}</select>
        <select value={route} onChange={(event) => setRoute(event.target.value)}><option value="ALL">All Routes</option>{options.routes.map((value) => <option key={value} value={value}>{value}</option>)}</select>
        <select value={driver} onChange={(event) => setDriver(event.target.value)}><option value="ALL">All Drivers</option>{options.drivers.map((value) => <option key={value} value={value}>{value}</option>)}</select>
        <button type="button" className="trip-history-v3-clear trip-history-v3-clear-filters" onClick={clearFilters} disabled={!hasActiveFilters}><X size={15} /> Clear filters</button>
        <button className="primary-button trip-history-v3-export" onClick={() => downloadCsv(filteredTrips)}><Download size={16} /> Export</button>
        {shuttleId && <button className="trip-history-v3-clear" onClick={onClearShuttle}><X size={15} /> View all</button>}
      </div>
      <div className="trip-history-v3-table-wrap"><table className="trip-history-v3-table"><thead><tr><th>#</th><th>Trip ID</th><th>Shuttle</th><th>Route</th><th>Driver</th><th>Start time</th><th>End time</th><th>Duration</th><th>Distance</th><th>Passengers</th><th>Type</th><th>Status</th><th>Actions</th></tr></thead><tbody>{pageRows.map((trip, index) => <tr key={trip.id}><td>{(currentPage - 1) * pageSize + index + 1}</td><td><button className="trip-history-v3-link" onClick={() => onSelectTrip(trip.id)}>{trip.trip_code}</button></td><td><span className="trip-history-v3-shuttle"><BusFront size={17} />{trip.bus_number || trip.shuttle_id}</span></td><td>{trip.route_name || 'Incoming route'}</td><td>{trip.driver_name || 'Unassigned'}</td><td><strong>{formatDate(trip.started_at)}</strong><small>{formatTime(trip.started_at)}</small></td><td><strong>{formatDate(trip.ended_at)}</strong><small>{formatTime(trip.ended_at)}</small></td><td>{formatDuration(trip.started_at, trip.ended_at)}</td><td>—</td><td>—</td><td><span className={`trip-history-v3-type ${trip.trip_mode === 'SIMULATION' ? 'simulation' : ''}`}>{trip.trip_mode || 'REAL'}</span></td><td><span className={`trip-history-v3-status ${statusClass(trip.status)}`}><i />{trip.status.replace(/_/g, ' ')}</span></td><td><span className="trip-history-v3-actions"><button aria-label={`More actions for ${trip.trip_code}`} onClick={() => notify(`${trip.trip_code} actions are ready`)}><MoreVertical size={17} /></button><button aria-label={`Open ${trip.trip_code}`} onClick={() => onSelectTrip(trip.id)}><ChevronDown size={17} /></button></span></td></tr>)}</tbody></table>{!pageRows.length && <div className="trip-history-v3-empty">No trips match the selected filters.</div>}</div>
      <footer className="trip-history-v3-footer"><span>Showing {filteredTrips.length ? (currentPage - 1) * pageSize + 1 : 0} to {Math.min(currentPage * pageSize, filteredTrips.length)} of {filteredTrips.length} trips</span><div><button disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>‹</button>{Array.from({ length: Math.min(totalPages, 5) }, (_, index) => index + 1).map((value) => <button className={value === currentPage ? 'active' : ''} key={value} onClick={() => setPage(value)}>{value}</button>)}<button disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>›</button></div></footer>
    </div>
  </section>
}
