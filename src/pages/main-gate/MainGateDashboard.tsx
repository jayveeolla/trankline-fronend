import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BusFront, CalendarDays, CheckCheck, ChevronDown, ClipboardList, Clock3, Download, Eye, LayoutDashboard, LogOut, Menu, Moon, MoreHorizontal, Navigation, Search, ShieldCheck, Sun, UserRound, Users, X } from 'lucide-react'
import { api, type MainGatePassenger, type MainGateToday, type MainGateTrip, type SessionUser } from '../../api'
import { getRealtimeSocket } from '../../realtime'
import ProfilePage from '../profile/ProfilePage'
import './main-gate.css'

const home = '/main-gate'
const nav = [
  { label: 'Dashboard', path: home, icon: LayoutDashboard },
  { label: 'Incoming Shuttles', path: `${home}/incoming`, icon: BusFront },
  { label: "Today's Manifest", path: `${home}/todays-manifest`, icon: ClipboardList },
  { label: 'Manifest History', path: `${home}/manifest-history`, icon: Clock3 },
  { label: 'Profile', path: `${home}/profile`, icon: UserRound },
]

const dateLabel = (date: string) => date ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'full', timeZone: 'Asia/Manila' }).format(new Date(`${date}T12:00:00+08:00`)) : '—'
const timeLabel = (date?: string | null) => date ? new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' }).format(new Date(date)) : '—'
const statusLabel = (status: string) => ({ NOT_STARTED: 'SCHEDULED', AT_PICKUP_POINT: 'BOARDING', APPROACHING_STOP: 'APPROACHING STOP', HEADING_TO_TDK: 'HEADING TO TDK', EN_ROUTE: 'EN ROUTE', PAUSED: 'PAUSED', COMPLETED: 'ARRIVED', CANCELLED: 'CANCELLED' }[status] || status.replace(/_/g, ' '))
const statusTone = (status: string) => status === 'CANCELLED' ? 'danger' : status === 'COMPLETED' ? 'success' : ['HEADING_TO_TDK', 'APPROACHING_STOP'].includes(status) ? 'warning' : status === 'PAUSED' ? 'muted' : 'info'
const locationLabel = (trip: MainGateTrip) => trip.status === 'COMPLETED' ? 'TDK' : trip.approaching_tdk && trip.distance_to_tdk_meters !== null ? `${(trip.distance_to_tdk_meters / 1000).toFixed(1)} km to TDK` : trip.current_stop || (trip.latitude !== null && trip.longitude !== null ? `${Number(trip.latitude).toFixed(4)}, ${Number(trip.longitude).toFixed(4)}` : 'Awaiting GPS')

function TripTable({ trips, navigate, download, downloading }: { trips: MainGateTrip[]; navigate: (path: string) => void; download: (id: number) => void; downloading: boolean }) {
  if (!trips.length) return <div className="mg-empty">No incoming shuttle trips found. Trips appear here when a TDK-bound trip is started.</div>
  return <div className="mg-table-wrap"><table className="mg-table"><thead><tr><th>Shuttle / Trip ID</th><th>Route / Driver</th><th>Departure / ETA</th><th>Passengers</th><th>Available</th><th>Current location / stop</th><th>Status</th><th>Manifest</th></tr></thead><tbody>{trips.map((trip) => <tr key={trip.id}>
    <td><strong>{trip.shuttle_code}</strong><small>{trip.trip_code}</small></td>
    <td><strong>{trip.route_name || '—'}</strong><small>{trip.driver_name || 'Unassigned'}</small></td>
    <td><strong>{timeLabel(trip.started_at)}</strong><small>ETA {timeLabel(trip.eta_at_tdk)}</small></td>
    <td><strong>{trip.passenger_count} / {trip.capacity}</strong><small>official boarded / capacity</small>{trip.test_passenger_count > 0 && <small>{trip.test_passenger_count} test {trip.test_passenger_count === 1 ? 'entry' : 'entries'}</small>}</td>
    <td>{trip.available_seats}</td>
    <td>{locationLabel(trip)}</td>
    <td><span className={`mg-badge ${trip.approaching_tdk ? 'warning' : statusTone(trip.status)}`}>{trip.approaching_tdk ? 'APPROACHING TDK' : statusLabel(trip.status)}</span></td>
    <td><div className="mg-actions"><button type="button" onClick={() => navigate(`${home}/trips/${trip.id}/manifest`)}><Eye size={15} /> View Manifest</button><button type="button" onClick={() => download(trip.id)} disabled={downloading}><Download size={15} /> Excel</button></div></td>
  </tr>)}</tbody></table></div>
}

function ManifestPassengerTable({ passengers, canVerify, busy, onVerify, onSignature }: { passengers: MainGatePassenger[]; canVerify: boolean; busy: boolean; onVerify: (id: number) => void; onSignature: (passenger: MainGatePassenger) => void }) {
  return <div className="mg-table-wrap"><table className="mg-table"><thead><tr><th>#</th><th>Seat No.</th><th>Employee No.</th><th>Employee Name</th><th>Boarding Stop</th><th>Boarding Time</th><th>Boarding Location</th><th>Signature</th><th>Verification</th></tr></thead><tbody>{passengers.map((passenger, index) => <tr key={passenger.id} className={passenger.is_test ? 'mg-test-row' : undefined}>
    <td>{index + 1}</td><td>{passenger.seat_number}</td><td>{passenger.employee_number}</td>
    <td><strong>{passenger.employee_name}</strong>{Boolean(passenger.is_test) && <small>TEST ENTRY</small>}</td>
    <td>{passenger.boarding_stop_name || '—'}</td><td>{timeLabel(passenger.boarded_at)}</td>
    <td>{passenger.boarded_latitude !== null && passenger.boarded_longitude !== null ? `${Number(passenger.boarded_latitude).toFixed(5)}, ${Number(passenger.boarded_longitude).toFixed(5)}` : '—'}</td>
    <td>{passenger.signature_data?.startsWith('data:image/') ? <button className="mg-signature-preview" onClick={() => onSignature(passenger)}><img src={passenger.signature_data} alt={`Signature of ${passenger.employee_name}`} /> View Signature</button> : 'No signature'}</td>
    <td>{passenger.is_test ? <span className="mg-badge warning">TEST ONLY</span> : passenger.verification_status === 'VERIFIED' ? <span className="mg-badge success">VERIFIED</span> : canVerify ? <button disabled={busy} onClick={() => onVerify(passenger.id)}><ShieldCheck size={15} /> Verify</button> : <span className="mg-badge muted">PENDING</span>}</td>
  </tr>)}</tbody></table></div>
}

export default function MainGateDashboard({ user, onLogout, onProfileUpdated }: { user: SessionUser; onLogout: () => void; onProfileUpdated: (user: SessionUser, token: string) => void }) {
  const [path, setPath] = useState(() => window.location.pathname)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => window.localStorage.getItem('trackline-theme') === 'light' ? 'light' : 'dark')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [sidebarAccountMenuOpen, setSidebarAccountMenuOpen] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement>(null)
  const sidebarAccountMenuRef = useRef<HTMLDivElement>(null)
  const [today, setToday] = useState<MainGateToday | null>(null)
  const [history, setHistory] = useState<MainGateTrip[]>([])
  const [manifest, setManifest] = useState<{ trip: MainGateTrip; passengers: MainGatePassenger[] } | null>(null)
  const [signature, setSignature] = useState<MainGatePassenger | null>(null)
  const [filters, setFilters] = useState({ date: '', shuttle: '', route: '', tripId: '', status: '' })
  const [reviewed, setReviewed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const manifestId = /^\/main-gate\/trips\/(\d+)\/manifest$/.exec(path)?.[1]
  const isHistory = path === `${home}/manifest-history`
  const isProfile = path === `${home}/profile`
  const isTodayManifest = path === `${home}/todays-manifest`
  const isIncoming = path === `${home}/incoming`
  const isDashboard = path === home
  const recognized = isHistory || isProfile || isTodayManifest || isIncoming || isDashboard || Boolean(manifestId)

  const navigate = useCallback((next: string) => {
    window.history.pushState({}, '', next)
    setPath(next)
    setSidebarOpen(false)
    setAccountMenuOpen(false)
    setSidebarAccountMenuOpen(false)
    setError('')
  }, [])

  useEffect(() => {
    if (!accountMenuOpen && !sidebarAccountMenuOpen) return
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (accountMenuOpen && !accountMenuRef.current?.contains(event.target as Node)) setAccountMenuOpen(false)
      if (sidebarAccountMenuOpen && !sidebarAccountMenuRef.current?.contains(event.target as Node)) setSidebarAccountMenuOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setAccountMenuOpen(false); setSidebarAccountMenuOpen(false) }
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [accountMenuOpen, sidebarAccountMenuOpen])

  useEffect(() => {
    if (!recognized) { window.history.replaceState({}, '', home); setPath(home) }
  }, [recognized])
  useEffect(() => {
    const pop = () => { setPath(window.location.pathname); setAccountMenuOpen(false); setSidebarAccountMenuOpen(false) }
    window.addEventListener('popstate', pop)
    return () => window.removeEventListener('popstate', pop)
  }, [])
  useEffect(() => { window.localStorage.setItem('trackline-theme', theme) }, [theme])

  const reloadToday = useCallback(() => { api.mainGateToday().then(setToday).catch((cause) => setError(cause instanceof Error ? cause.message : 'Could not load incoming trips.')) }, [])
  const reloadHistory = useCallback(() => {
    const activeFilters = Object.fromEntries(Object.entries(filters).filter(([, value]) => value.trim()))
    api.mainGateHistory(activeFilters).then((result) => setHistory(result.trips)).catch((cause) => setError(cause instanceof Error ? cause.message : 'Could not load manifest history.'))
  }, [filters])
  const reloadManifest = useCallback(() => {
    if (!manifestId) return
    api.mainGateManifest(Number(manifestId)).then(setManifest).catch((cause) => setError(cause instanceof Error ? cause.message : 'Could not load manifest.'))
  }, [manifestId])

  useEffect(() => { if (!isHistory && !isProfile) reloadToday() }, [isHistory, isProfile, reloadToday])
  useEffect(() => { if (isHistory) reloadHistory() }, [isHistory, reloadHistory])
  useEffect(() => { setManifest(null); setReviewed(false); reloadManifest() }, [reloadManifest])
  useEffect(() => {
    const socket = getRealtimeSocket()
    const refresh = () => { if (!isHistory && !isProfile) reloadToday(); if (manifestId) reloadManifest() }
    socket.on('main-gate:updated', refresh)
    const timer = window.setInterval(refresh, 30_000)
    return () => { socket.off('main-gate:updated', refresh); window.clearInterval(timer) }
  }, [isHistory, isProfile, manifestId, reloadToday, reloadManifest])

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true); setError('')
    try { await action(); setNotice(success); reloadToday(); reloadManifest() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Action failed.') }
    finally { setBusy(false) }
  }
  const downloadTrip = (id: number) => { void run(() => api.mainGateExportTrip(id), 'Incoming manifest downloaded.') }
  const todayTrips = today?.trips || []
  const distinctShuttles = useMemo(() => [...new Set(history.map((trip) => trip.shuttle_id))].sort(), [history])
  const distinctRoutes = useMemo(() => [...new Map(history.filter((trip) => trip.route_id).map((trip) => [trip.route_id, trip.route_name])).entries()], [history])
  const selectedTrip = manifest?.trip
  const canVerify = selectedTrip && selectedTrip.trip_date === today?.date && !['COMPLETED', 'CANCELLED'].includes(selectedTrip.status)
  const pageTitle = manifestId ? 'Incoming Shuttle Manifest' : isHistory ? 'Manifest History' : isTodayManifest ? "Today's Incoming Manifests" : isIncoming ? 'Incoming Shuttles' : isProfile ? 'Profile' : 'Incoming Shuttle Monitoring'

  return <div className={`app-shell mg-shell ${theme} ${sidebarCollapsed ? 'mg-sidebar-collapsed' : ''}`}>
    {sidebarOpen && <button className="mg-backdrop" aria-label="Close menu" onClick={() => { setSidebarOpen(false); setSidebarAccountMenuOpen(false) }} />}
    <aside className={`mg-sidebar ${sidebarOpen ? 'open' : ''}`}>
      <div className="mg-brand"><span className="mg-brand-icon"><Navigation size={22} /></span><div><strong>trackline</strong><small>MAIN GATE · TDK</small></div><button className="mg-sidebar-toggle" onClick={() => { setSidebarOpen(false); if (window.innerWidth > 760) setSidebarCollapsed((collapsed) => !collapsed); setSidebarAccountMenuOpen(false) }} aria-label={sidebarOpen ? 'Close menu' : sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={sidebarOpen ? 'Close menu' : sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}><Menu size={20} /></button></div>
      <div className="mg-nav-caption">INCOMING MONITORING</div>
      <nav aria-label="Main Gate navigation">{nav.map(({ label, path: route, icon: Icon }) => <button key={route} className={`mg-nav-link ${path === route || (manifestId && route === `${home}/todays-manifest`) ? 'active' : ''}`} aria-label={label} title={sidebarCollapsed ? label : undefined} onClick={() => navigate(route)}><Icon size={18} /><span>{label}</span></button>)}</nav>
      <div className="mg-sidebar-bottom">
        <div className="mg-sidebar-note"><ShieldCheck size={15} /> Read-only boarding records</div>
        <div className="mg-sidebar-account" ref={sidebarAccountMenuRef}>
          <button className="mg-sidebar-avatar-button" onClick={() => { setSidebarAccountMenuOpen((open) => !open); setAccountMenuOpen(false) }} aria-label="Open sidebar account menu" aria-haspopup="menu" aria-expanded={sidebarAccountMenuOpen}><span className="mg-account-avatar">{user.avatar_data ? <img src={user.avatar_data} alt="" /> : user.name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span></button>
          <div className="mg-sidebar-account-copy"><strong>{user.name}</strong><small>MAIN_GATE account</small></div>
          <button className="mg-sidebar-account-more" onClick={() => { setSidebarAccountMenuOpen((open) => !open); setAccountMenuOpen(false) }} aria-label="Open sidebar account menu" aria-haspopup="menu" aria-expanded={sidebarAccountMenuOpen}><MoreHorizontal size={19} /></button>
          {sidebarAccountMenuOpen && <div className="mg-account-menu mg-sidebar-account-menu" role="menu"><button role="menuitem" onClick={() => navigate(`${home}/profile`)}><UserRound size={16} /> Profile</button><button role="menuitem" onClick={() => { setSidebarAccountMenuOpen(false); onLogout() }}><LogOut size={16} /> Sign out</button></div>}
        </div>
      </div>
    </aside>
    <div className="mg-main"><header className="mg-topbar"><button className="mg-menu" onClick={() => { setSidebarCollapsed(false); setSidebarOpen(true) }} aria-label="Show sidebar" title="Show sidebar"><Menu size={20} /></button><strong>Main Gate</strong><div><button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">{theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}</button><div className="mg-account-wrap" ref={accountMenuRef}><button className="mg-account-button" onClick={() => { setAccountMenuOpen((open) => !open); setSidebarAccountMenuOpen(false) }} aria-label="Open account menu" aria-haspopup="menu" aria-expanded={accountMenuOpen}><span className="mg-account-avatar">{user.avatar_data ? <img src={user.avatar_data} alt="" /> : user.name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span><span className="mg-account-name">{user.name}</span><ChevronDown size={14} /></button>{accountMenuOpen && <div className="mg-account-menu" role="menu"><button role="menuitem" onClick={() => navigate(`${home}/profile`)}><UserRound size={16} /> Profile</button><button role="menuitem" onClick={() => { setAccountMenuOpen(false); onLogout() }}><LogOut size={16} /> Sign out</button></div>}</div></div></header>
      <main className="mg-content"><div className="mg-heading"><div><div className="mg-eyebrow"><span /> MAIN GATE</div><h1>{pageTitle}</h1><p>{isProfile ? 'Manage your account details.' : isHistory ? 'Review previous incoming TDK shuttle manifests.' : 'Monitor today’s incoming shuttles and verify passenger manifests.'}</p></div>{!isProfile && <div className="mg-date"><CalendarDays size={18} />{dateLabel(today?.date || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date()))}</div>}</div>
        {error && <div className="mg-message error" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss error"><X size={15} /></button></div>}
        {notice && <div className="mg-message success" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notice"><X size={15} /></button></div>}
        {isProfile ? <ProfilePage user={user} notify={setNotice} onUpdated={onProfileUpdated} /> : manifestId ? <>
          <div className="mg-panel mg-manifest-head"><div className="mg-section-title"><div><span className="mg-kicker">INCOMING SHUTTLE MANIFEST</span><h2>{selectedTrip?.shuttle_code || 'Loading manifest…'}</h2><p>{selectedTrip?.route_name || '—'} · Trip {selectedTrip?.trip_code || manifestId}</p></div><div className="mg-actions"><button onClick={() => navigate(`${home}/todays-manifest`)}>Back</button><button className="mg-primary" disabled={!selectedTrip || busy} onClick={() => selectedTrip && downloadTrip(selectedTrip.id)}><Download size={16} /> Download Excel</button></div></div>
            {selectedTrip && <div className="mg-trip-facts">{[['Shuttle', selectedTrip.shuttle_code], ['Route', selectedTrip.route_name || '—'], ['Driver', selectedTrip.driver_name || 'Unassigned'], ['Trip Date', dateLabel(selectedTrip.trip_date)], ['Departure', timeLabel(selectedTrip.started_at)], ['Arrival / ETA', timeLabel(selectedTrip.arrived_at_tdk || selectedTrip.eta_at_tdk)], ['Status', statusLabel(selectedTrip.status)], ['Total Capacity', selectedTrip.capacity], ['Official Passengers', selectedTrip.passenger_count], ['Test Entries', selectedTrip.test_passenger_count], ['Available Seats', selectedTrip.available_seats]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>}
          </div>
          <div className="mg-panel"><div className="mg-section-title"><div><h2>Passenger Manifest</h2><p>Trip-specific boarded records, seats, stops, and captured signatures.</p></div>{canVerify && selectedTrip.passenger_count > 0 && <div className="mg-verify-all"><label><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} /> I reviewed this manifest</label><button disabled={!reviewed || busy} onClick={() => void run(() => api.mainGateVerifyAll(selectedTrip.id), 'All official passengers verified.')}><CheckCheck size={16} /> Verify All</button></div>}</div>
            {Boolean(selectedTrip?.test_passenger_count) && <div className="mg-test-notice">{selectedTrip?.test_passenger_count} test {selectedTrip?.test_passenger_count === 1 ? 'entry is' : 'entries are'} shown below for reference. Test entries are not official passengers and cannot be verified or included in Excel downloads.</div>}
            {!manifest?.passengers.length ? <div className="mg-empty">No boarded passengers recorded for this incoming trip.</div> : <ManifestPassengerTable passengers={manifest.passengers} canVerify={Boolean(canVerify)} busy={busy} onSignature={setSignature} onVerify={(passengerId) => selectedTrip && void run(() => api.mainGateVerify(selectedTrip.id, passengerId), 'Passenger verified.')} />}
          </div>
        </> : <>
          {!isHistory && <>
            <div className="mg-summary">{[['Incoming Shuttles', today?.summary.incomingShuttles ?? '—', BusFront], ['Currently En Route', today?.summary.currentlyEnRoute ?? '—', Navigation], ['Arrived at TDK', today?.summary.arrivedAtTdk ?? '—', CheckCheck], ['Expected Passengers', today?.summary.expectedPassengers ?? '—', Users], ['Boarded Passengers', today?.summary.boardedPassengers ?? '—', ShieldCheck]].map(([label, value, Icon]) => { const CardIcon = Icon as typeof BusFront; return <div className="mg-stat" key={label as string}><span><CardIcon size={20} /></span><small>{label as string}</small><strong>{value as number | string}</strong></div> })}</div>
            <div className="mg-toolbar"><div><strong>{isTodayManifest ? "Today's Incoming Manifests" : "Today's Incoming Shuttles"}</strong><small>TDK-bound actual trips · Expected passengers = scheduled and started trip capacity</small></div><button className="mg-primary" disabled={busy || !todayTrips.length} onClick={() => void run(api.mainGateExportToday, "Today's incoming manifests downloaded.")}><Download size={17} /> Download Today's Manifest</button></div>
            <div className="mg-panel"><TripTable trips={todayTrips} navigate={navigate} download={downloadTrip} downloading={busy} /></div>
            {!isTodayManifest && Boolean(today?.scheduled.length) && <div className="mg-panel"><div className="mg-section-title"><div><h2>Scheduled Incoming Shuttles</h2><p>Real TDK-bound schedules and assignments. Manifests and Excel become available when a trip starts.</p></div></div><div className="mg-table-wrap"><table className="mg-table"><thead><tr><th>Shuttle</th><th>Route</th><th>Driver</th><th>Departure</th><th>ETA at TDK</th><th>Expected Seats</th><th>Status</th><th>Manifest</th></tr></thead><tbody>{today?.scheduled.map((item) => <tr key={`${item.schedule_id}:${item.shuttle_id}`}><td><strong>{item.shuttle_code}</strong></td><td>{item.route_name}</td><td>{item.driver_name || 'Unassigned'}</td><td>{timeLabel(item.departure_at)}</td><td>{timeLabel(item.eta_at_tdk)}</td><td>{item.capacity}</td><td><span className="mg-badge muted">SCHEDULED</span></td><td>Available after trip starts</td></tr>)}</tbody></table></div></div>}
          </>}
          {isHistory && <><div className="mg-panel mg-history-filters"><label>Date<input type="date" value={filters.date} onChange={(event) => setFilters({ ...filters, date: event.target.value })} /></label><label>Shuttle<select value={filters.shuttle} onChange={(event) => setFilters({ ...filters, shuttle: event.target.value })}><option value="">All Shuttles</option>{distinctShuttles.map((item) => <option key={item}>{item}</option>)}</select></label><label>Route<select value={filters.route} onChange={(event) => setFilters({ ...filters, route: event.target.value })}><option value="">All Routes</option>{distinctRoutes.map(([id, name]) => <option key={id} value={id || ''}>{name}</option>)}</select></label><label>Trip ID<input value={filters.tripId} onChange={(event) => setFilters({ ...filters, tripId: event.target.value })} placeholder="Search trip ID" /></label><label>Status<select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All Statuses</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option></select></label><button onClick={() => setFilters({ date: '', shuttle: '', route: '', tripId: '', status: '' })}><Search size={15} /> Clear filters</button></div><div className="mg-panel"><div className="mg-section-title"><div><h2>Previous Incoming Manifests</h2><p>{history.length} matching incoming trips · historical records are read-only</p></div></div><TripTable trips={history} navigate={navigate} download={downloadTrip} downloading={busy} /></div></>}
        </>}
      </main>
    </div>
    {signature && <div className="mg-modal-backdrop" onMouseDown={() => setSignature(null)}><div className="mg-modal" role="dialog" aria-modal="true" aria-label="Passenger Signature" onMouseDown={(event) => event.stopPropagation()}><button className="mg-modal-close" onClick={() => setSignature(null)} aria-label="Close signature"><X size={20} /></button><div className="mg-kicker">CAPTURED BOARDING RECORD</div><h2>Passenger Signature</h2><p><strong>Employee:</strong> {signature.employee_name}</p><p><strong>Employee No:</strong> {signature.employee_number}</p><p><strong>Seat:</strong> {signature.seat_number}</p><p><strong>Boarded At:</strong> {signature.boarding_stop_name || '—'}</p><p><strong>Boarding Time:</strong> {timeLabel(signature.boarded_at)}</p><div className="mg-full-signature">{signature.signature_data && <img src={signature.signature_data} alt={`Captured boarding signature of ${signature.employee_name}`} />}</div><small>Original signature is read-only.</small></div></div>}
  </div>
}
