import { useEffect, useMemo, useState } from 'react'
import { BusFront, ChevronDown, Clock3, Gauge, Pause, Play, Route, Users, X, Zap } from 'lucide-react'
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { api, type ApiAlert, type ApiPassenger, type ApiSeat, type ApiTrip } from './api'
import { parseRouteGeometry } from './routeUtils'
import TripHistoryListPage from './pages/trip-history/TripHistoryListPage'

type TripHistoryPageProps = { notify: (message: string) => void; shuttleId?: string | null; tripId?: string | null; onClearShuttle?: () => void; onSelectTrip?: (tripId: number) => void }
type TripDetail = Awaited<ReturnType<typeof api.trip>> & { passengers: ApiPassenger[]; seats: ApiSeat[]; alerts: ApiAlert[]; canViewSignatures: boolean }
type Point = [number, number]

const defaultCenter: Point = [14.2724796, 121.0632645]
const busIcon = L.divIcon({ className: 'history-v2-bus-marker', html: '<span>BUS</span>', iconSize: [40, 32], iconAnchor: [20, 16] })
const startIcon = L.divIcon({ className: 'history-v2-start-marker', html: '<span>START</span>', iconSize: [58, 25], iconAnchor: [29, 12] })
const destinationIcon = L.divIcon({ className: 'history-v2-end-marker', html: '<span>★</span><strong>TDK</strong>', iconSize: [45, 40], iconAnchor: [22, 34] })
const stopIcon = (sequence: number) => L.divIcon({ className: 'history-v2-stop-marker', html: `<span>${sequence}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] })

function MapFit({ points }: { points: Point[] }) {
  const map = useMap()
  useEffect(() => { if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [20, 20] }) }, [map, points])
  return null
}

function time(value?: string | null) {
  return value ? new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—'
}

function date(value?: string | null) {
  return value ? new Date(value).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'
}

function tripDuration(start?: string | null, end?: string | null) {
  if (!start || !end) return '—'
  const seconds = Math.max(0, (new Date(end).getTime() - new Date(start).getTime()) / 1000)
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
}

function distance(points: Point[]) {
  const radius = 6371
  return points.slice(1).reduce((total, point, index) => {
    const previous = points[index]
    const lat1 = previous[0] * Math.PI / 180
    const lat2 = point[0] * Math.PI / 180
    const dLat = (point[0] - previous[0]) * Math.PI / 180
    const dLon = (point[1] - previous[1]) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
    return total + radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }, 0)
}

function formatDistance(value: number) {
  return value < 1 ? `${Math.round(value * 1000)} m` : `${value.toFixed(1)} km`
}

export default function TripHistoryPage({ notify, shuttleId, tripId, onClearShuttle, onSelectTrip }: TripHistoryPageProps) {
  const [trips, setTrips] = useState<ApiTrip[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<TripDetail | null>(null)
  const [tab, setTab] = useState('Overview')
  const [showPlanned, setShowPlanned] = useState(true)
  const [playIndex, setPlayIndex] = useState<number | null>(null)
  const [playSpeed, setPlaySpeed] = useState(1)
  const [loading, setLoading] = useState(false)
  const [signaturePassenger, setSignaturePassenger] = useState<ApiPassenger | null>(null)

  useEffect(() => {
    const moveAlertsUnderMessages = () => {
      const content = document.querySelector<HTMLElement>('.history-v2-content:has(.history-v2-main-grid)')
      const bottomGrid = content?.querySelector<HTMLElement>(':scope > .history-v2-bottom-grid')
      const messageColumn = bottomGrid?.children.item(1) as HTMLElement | null
      const alertColumn = bottomGrid?.children.item(2) as HTMLElement | null
      const alertCard = alertColumn?.querySelector<HTMLElement>(':scope > .history-v2-card')
      if (!messageColumn || !alertColumn || !alertCard) return
      if (alertCard.parentElement !== messageColumn) messageColumn.appendChild(alertCard)
      alertColumn.hidden = true
    }
    const observer = new MutationObserver(moveAlertsUnderMessages)
    observer.observe(document.body, { childList: true, subtree: true })
    moveAlertsUnderMessages()
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const grid = document.querySelector<HTMLElement>('.history-v2-content .history-v2-seat-grid')
    if (!grid || !detail?.seats.length) return
    const maxColumn = Math.max(1, ...detail.seats.map((seat) => Number(seat.column_position) || 1))
    grid.style.gridTemplateColumns = `repeat(${maxColumn}, minmax(0, 1fr))`
    return () => { grid.style.removeProperty('grid-template-columns') }
  }, [detail])

  const visibleTrips = useMemo(() => shuttleId ? trips.filter((trip) => trip.shuttle_id === shuttleId) : trips, [shuttleId, trips])

  useEffect(() => {
    api.trips().then(({ trips: rows }) => {
      setTrips(rows)
      const requestedTrip = tripId ? rows.find((trip) => String(trip.id) === tripId || trip.trip_code === tripId) : undefined
      setSelectedId(requestedTrip?.id || null)
    }).catch((error) => notify(error instanceof Error ? error.message : 'Could not load trip history'))
  }, [notify, shuttleId, tripId])

  useEffect(() => {
    if (selectedId !== null && !visibleTrips.some((trip) => trip.id === selectedId)) setSelectedId(null)
  }, [selectedId, visibleTrips])

  useEffect(() => {
    if (!selectedId) return
    const summary = trips.find((trip) => trip.id === selectedId)
    if (!summary) return
    setLoading(true); setDetail(null); setPlayIndex(null); setTab('Overview')
    Promise.all([
      api.trip(selectedId),
      api.tripPassengers(selectedId),
      api.shuttleSeats(summary.shuttle_id).catch(() => ({ seats: [] as ApiSeat[] })),
      api.alerts({ limit: 500 }).catch(() => ({ alerts: [] as ApiAlert[], unreadCount: 0 })),
    ]).then(([trip, passengerResult, seatResult, alertResult]) => {
      setDetail({ ...trip, passengers: passengerResult.passengers, seats: seatResult.seats, alerts: alertResult.alerts.filter((alert) => Number(alert.trip_id) === selectedId), canViewSignatures: passengerResult.can_view_signatures })
    }).catch((error) => notify(error instanceof Error ? error.message : 'Could not load trip details')).finally(() => setLoading(false))
  }, [selectedId, trips, notify])

  const actual = useMemo(() => detail?.locations.slice().sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()).map((point) => [Number(point.latitude), Number(point.longitude)] as Point) || [], [detail])
  const planned = useMemo(() => parseRouteGeometry(detail?.trip.route_geometry), [detail])
  const [activePoint, setActivePoint] = useState<Point | null>(null)
  const trail = playIndex === null ? actual : actual.slice(0, playIndex + 1)
  const busPoint = activePoint || actual[playIndex === null ? actual.length - 1 : playIndex]
  const center = busPoint || actual[0] || planned[0] || defaultCenter
  const totalDistance = distance(actual)
  const endTime = detail?.trip.ended_at || detail?.trip.arrived_at_tdk || detail?.locations[detail.locations.length - 1]?.recorded_at
  const averageSpeed = detail ? detail.locations.filter((point) => Number(point.speed) > 0).reduce((sum, point, _, rows) => sum + Number(point.speed) / rows.length, 0) : 0
  const occupied = detail?.passengers.length || 0
  const capacity = detail?.seats.length || detail?.passengers.length || 0
  const tabs = ['Overview', 'Route & Playback', 'Stops', 'Passengers', 'Seat Map', 'Messages', 'Alerts', 'Events', 'Logs']
  const selectTrip = (nextId: number) => {
    setSelectedId(nextId)
    if (onSelectTrip) onSelectTrip(nextId)
    else if (!tripId) {
      window.history.pushState({}, '', `/trip-history/${nextId}`)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  }

  useEffect(() => {
    if (playIndex === null || actual.length < 2) return
    const timer = window.setInterval(() => setPlayIndex((value) => value === null || value >= actual.length - 1 ? null : value + 1), Math.max(100, 700 / playSpeed))
    return () => window.clearInterval(timer)
  }, [playIndex, playSpeed, actual.length])

  if (!detail) return <TripHistoryListPage trips={visibleTrips} allTrips={trips} notify={notify} onSelectTrip={selectTrip} shuttleId={shuttleId} onClearShuttle={onClearShuttle} />

  const renderMap = (large = false) => <div className={`history-v2-map ${large ? 'large' : ''}`}><MapContainer center={center} zoom={13} scrollWheelZoom style={{ width: '100%', height: '100%' }}><TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><MapFit points={[...planned, ...actual]} />{showPlanned && planned.length > 1 && <Polyline positions={planned} pathOptions={{ color: '#91a4b7', weight: 4, dashArray: '8 8' }} />}{trail.length > 1 && <Polyline positions={trail} pathOptions={{ color: '#1678ee', weight: 6 }} />}{actual[0] && <Marker position={actual[0]} icon={startIcon} />}{detail?.stopStatus.map((stop, index) => <Marker key={stop.stop_id} position={[Number(stop.latitude), Number(stop.longitude)]} icon={stopIcon(index + 1)} />)}{planned[planned.length - 1] && <Marker position={planned[planned.length - 1]} icon={destinationIcon} />}{busPoint && <Marker position={busPoint} icon={busIcon} />}</MapContainer><div className="history-v2-map-legend"><span><i className="actual" />Actual GPS</span><span><i className="planned" />Planned route</span><span><i className="stops" />Pickup stops</span></div></div>

  const renderPlayback = () => <div className="history-v2-playback"><button className="history-play-button" onClick={() => setPlayIndex(playIndex === null ? 0 : null)}>{playIndex === null ? <Play size={15} /> : <Pause size={15} />}</button><div className="history-play-track"><strong>{busPoint && detail ? time(detail.locations[playIndex === null ? detail.locations.length - 1 : playIndex]?.recorded_at) : '—'}</strong><input type="range" min="0" max={Math.max(0, actual.length - 1)} value={playIndex ?? Math.max(0, actual.length - 1)} onChange={(event) => { setPlayIndex(Number(event.target.value)); setActivePoint(null) }} /></div><div className="history-play-actions">{[1, 2, 4, 10].map((speed) => <button key={speed} className={playSpeed === speed ? 'active' : ''} onClick={() => setPlaySpeed(speed)}>{speed}x</button>)}<button onClick={() => setPlayIndex(0)}>Restart</button></div></div>

  const renderStops = (compact = false) => <div className={`history-v2-stops ${compact ? 'compact' : ''}`}><div className="history-v2-section-heading"><strong>Route stops</strong><span>{detail?.stopStatus.length || 0} pickup points</span></div>{detail?.stopStatus.length ? detail.stopStatus.map((stop, index) => <div className="history-v2-stop" key={stop.stop_id}><b>{index + 1}</b><div><strong>{stop.pickup_name}</strong><span>{stop.status}</span><small>{stop.arrived_at ? `Arrived ${time(stop.arrived_at)}` : 'Arrival not recorded'}{stop.departed_at ? ` · Departed ${time(stop.departed_at)}` : ''}</small></div></div>) : <div className="history-v2-empty">No stop status records for this trip.</div>}</div>

  const renderPassengers = () => <div className="history-v2-card"><div className="history-v2-section-heading"><strong>Passenger manifest ({occupied})</strong><button className="secondary-button compact" onClick={() => notify('Passenger export can be connected to CSV/PDF next')}>Export</button></div>{detail?.passengers.length ? <div className="history-v2-table-wrap"><div className="history-v2-table history-v2-table-head"><span>Seat</span><span>Employee</span><span>Boarded at</span><span>Stop</span><span>Status</span>{detail.canViewSignatures && <span>Signature</span>}</div>{detail.passengers.map((passenger) => <div className="history-v2-table history-v2-table-row" key={passenger.id}><strong>{passenger.seat_number}</strong><span>{passenger.employee_number}<small>{passenger.employee_name}</small></span><time>{time(passenger.boarded_at)}</time><span>{passenger.boarding_stop_name || '—'}</span><span className="history-v2-status">{passenger.status}</span>{detail.canViewSignatures && <span>{passenger.signature_data ? <button className="history-signature-link" onClick={() => setSignaturePassenger(passenger)}>View</button> : '—'}</span>}</div>)}</div> : <div className="history-v2-empty">No passenger records for this trip.</div>}</div>

  const renderSeats = () => {
    const positionOf = (seat: ApiSeat) => ({ row: Math.max(1, Number(seat.row_position) || 1), column: Math.max(1, Number(seat.column_position) || 1) })
    const maxRow = Math.max(1, ...(detail?.seats || []).map((seat) => positionOf(seat).row))
    const maxColumn = Math.max(1, ...(detail?.seats || []).map((seat) => positionOf(seat).column))
    const seatByPosition = new Map((detail?.seats || []).map((seat) => {
      const position = positionOf(seat)
      return [`${position.row}:${position.column}`, seat]
    }))
    const passengerBySeat = new Map((detail?.passengers || []).map((passenger) => [String(passenger.seat_number), passenger]))
    const seatCells = Array.from({ length: maxRow }, (_, rowIndex) => rowIndex + 1).flatMap((row) => Array.from({ length: maxColumn }, (_, columnIndex) => columnIndex + 1).map((column) => {
      const seat = seatByPosition.get(`${row}:${column}`)
      if (!seat) return <span className="history-v2-seat empty-cell" key={`${row}-${column}`} aria-hidden="true" />
      const passenger = passengerBySeat.get(String(seat.seat_number))
      const state = passenger ? 'occupied' : seat.seat_type === 'PASSENGER' && seat.is_active ? 'available' : 'unavailable'
      return <button className={`history-v2-seat ${state}`} type="button" key={seat.id} onClick={() => passenger && setSignaturePassenger(passenger)}><strong>{seat.seat_number}</strong>{passenger && <small>{passenger.employee_number}</small>}</button>
    }))
    return <div className="history-v2-card"><div className="history-v2-section-heading"><strong>Seat map - final occupancy</strong><span>{occupied} / {capacity || '—'} occupied</span></div><div className="history-v2-bus"><b>FRONT / DRIVER</b><div className="history-v2-seat-grid" style={{ gridTemplateColumns: `repeat(${maxColumn}, minmax(0, 1fr))` }}>{seatCells}</div></div><div className="history-v2-seat-legend"><span><i className="available" />Available</span><span><i className="occupied" />Occupied</span><span><i className="unavailable" />Unavailable</span></div></div>
  }

  const renderMessages = () => <div className="history-v2-card"><div className="history-v2-section-heading"><strong>Trip messages ({detail?.messages.length || 0})</strong><span>Read-only history</span></div>{detail?.messages.length ? detail.messages.map((message) => <article className={`history-v2-message ${message.severity.toLowerCase()}`} key={message.id}><div><strong>{message.sender_name || message.sender_role}</strong><small>{message.sender_role} · {time(message.created_at)}</small></div><p>{message.message}</p></article>) : <div className="history-v2-empty">No messages were recorded for this trip.</div>}</div>

  const renderAlerts = () => <div className="history-v2-card"><div className="history-v2-section-heading"><strong>Alerts ({detail?.alerts.length || 0})</strong></div>{detail?.alerts.length ? detail.alerts.map((alert) => <article className={`history-v2-alert ${alert.severity.toLowerCase()}`} key={alert.id}><b>{alert.severity}</b><div><strong>{alert.title || alert.alert_type}</strong><span>{alert.message}</span></div><time>{time(alert.created_at)}</time></article>) : <div className="history-v2-empty">No alerts are linked to this trip.</div>}</div>

  const renderEvents = () => { const events = detail ? [{ at: detail.trip.started_at, type: 'TRIP_STARTED', text: `${detail.trip.shuttle_id} started` }, ...detail.stopStatus.flatMap((stop) => [{ at: stop.arrived_at, type: 'STOP_ARRIVED', text: stop.pickup_name }, { at: stop.departed_at, type: 'STOP_DEPARTED', text: stop.pickup_name }]).filter((event) => event.at), ...detail.passengers.map((passenger) => ({ at: passenger.boarded_at, type: 'PASSENGER_BOARDED', text: `Seat ${passenger.seat_number} · ${passenger.employee_number}` })), ...(detail.trip.arrived_at_tdk ? [{ at: detail.trip.arrived_at_tdk, type: 'TDK_ARRIVAL_CONFIRMED', text: 'Destination reached' }] : []), ...(detail.trip.ended_at ? [{ at: detail.trip.ended_at, type: 'TRIP_COMPLETED', text: detail.trip.status }] : [])].sort((a, b) => new Date(a.at || '').getTime() - new Date(b.at || '').getTime()) : []; return <div className="history-v2-card"><div className="history-v2-section-heading"><strong>{tab === 'Logs' ? 'Trip logs' : 'System events'}</strong><span>Chronological record</span></div>{events.length ? events.map((event, index) => <div className="history-v2-event" key={`${event.type}-${event.at}-${index}`}><time>{date(event.at)}</time><strong>{event.type}</strong><span>{event.text}</span></div>) : <div className="history-v2-empty">No event records are available.</div>}</div> }

  if (!detail) return <section className="history-v2-trip-list"><div className="history-v2-list-heading"><span className="eyebrow small">SHUTTLE HISTORY</span><h3>{shuttleId ? `${shuttleId} trip history` : 'Trip history'}</h3><p>Select a trip to inspect its complete record.</p>{shuttleId && <button className="secondary-button compact" onClick={() => onClearShuttle?.()}>View all shuttle trips</button>}</div>{visibleTrips.length ? visibleTrips.map((trip) => <button className="history-v2-trip-row" key={trip.id} onClick={() => selectTrip(trip.id)}><span className="bus-mini blue-bus"><BusFront size={17} /></span><span><strong>{trip.trip_code}</strong><small>{trip.shuttle_id} · {trip.route_name || 'Incoming route'}</small></span><time>{date(trip.started_at)}</time><em className={trip.status === 'COMPLETED' ? 'complete' : ''}>{trip.status}</em><ChevronDown size={16} /></button>) : <div className="history-v2-empty">No trip history was found for {shuttleId || 'the fleet'}.</div>}{loading && <div className="history-v2-loading">Loading trip details…</div>}</section>

  const renderTab = () => { if (tab === 'Route & Playback') return <div className="history-v2-card">{renderMap(true)}{renderPlayback()}</div>; if (tab === 'Stops') return renderStops(); if (tab === 'Passengers') return renderPassengers(); if (tab === 'Seat Map') return renderSeats(); if (tab === 'Messages') return renderMessages(); if (tab === 'Alerts') return renderAlerts(); if (tab === 'Events' || tab === 'Logs') return renderEvents(); return <><div className="history-v2-main-grid"><div><div className="history-v2-card"><div className="history-v2-section-heading"><strong>Route playback</strong><button className="secondary-button compact" onClick={() => setShowPlanned((value) => !value)}>{showPlanned ? 'Hide planned route' : 'Show planned route'}</button></div>{renderMap()}{renderPlayback()}</div>{renderSeats()}</div><aside><div className="history-v2-card history-v2-information"><div className="history-v2-section-heading"><strong>Trip information</strong><em>{detail.trip.status}</em></div><dl><dt>Route</dt><dd>{detail.trip.route_name || 'Incoming route'}</dd><dt>Driver</dt><dd>{detail.trip.driver_name || '—'}</dd><dt>Started</dt><dd>{date(detail.trip.started_at)}</dd><dt>TDK arrival</dt><dd>{date(detail.trip.arrived_at_tdk)}</dd><dt>Duration</dt><dd>{tripDuration(detail.trip.started_at, endTime)}</dd><dt>Distance</dt><dd>{formatDistance(totalDistance)}</dd><dt>Average speed</dt><dd>{averageSpeed ? `${averageSpeed.toFixed(0)} km/h` : '—'}</dd></dl></div>{renderStops(true)}</aside></div><div className="history-v2-bottom-grid"><div>{renderPassengers()}</div><div>{renderMessages()}</div><div>{renderAlerts()}</div></div></> }

  return <section className="history-v2-record"><div className="history-v2-list-strip"><button className="secondary-button compact" onClick={() => { setDetail(null); setSelectedId(null) }}>← Back to trips</button><select value={selectedId || ''} onChange={(event) => setSelectedId(Number(event.target.value) || null)}>{visibleTrips.map((trip) => <option value={trip.id} key={trip.id}>{trip.trip_code} · {trip.shuttle_id}</option>)}</select></div><div className="history-v2-breadcrumb">Shuttles <span>›</span> {detail.trip.shuttle_id} <span>›</span> Trip History <span>›</span> {detail.trip.trip_code}</div><header className="history-v2-header"><div><div className="history-v2-title-line"><h2>{detail.trip.bus_number || detail.trip.shuttle_id}</h2><em>{detail.trip.status}</em><span>{detail.trip.trip_code}</span></div><p>{date(detail.trip.started_at)} · {detail.trip.route_name || 'Incoming route'}{detail.trip.trip_mode === 'SIMULATION' ? ' · SIMULATION' : ''}</p></div><button className="secondary-button compact" onClick={() => notify('Trip export can be connected to CSV/PDF next')}>Actions⌄</button></header><nav className="history-v2-tabs">{tabs.map((name) => <button className={tab === name ? 'active' : ''} key={name} onClick={() => setTab(name)}>{name}{name === 'Passengers' && <span>{occupied}</span>}{name === 'Messages' && <span>{detail.messages.length}</span>}{name === 'Alerts' && <span>{detail.alerts.length}</span>}</button>)}</nav><div className="history-v2-kpis"><div><Users size={18} /><span>Total passengers<strong>{occupied} / {capacity || '—'}</strong></span></div><div><BusFront size={18} /><span>Available seats<strong>{capacity ? capacity - occupied : '—'}</strong></span></div><div><Route size={18} /><span>Total distance<strong>{formatDistance(totalDistance)}</strong></span></div><div><Clock3 size={18} /><span>Total duration<strong>{tripDuration(detail.trip.started_at, endTime)}</strong></span></div><div><Gauge size={18} /><span>Average speed<strong>{averageSpeed ? `${averageSpeed.toFixed(0)} km/h` : '—'}</strong></span></div><div><Zap size={18} /><span>Trip status<strong>{detail.trip.status}</strong></span></div></div><div className="history-v2-content">{renderTab()}</div>{signaturePassenger && <div className="history-v2-signature-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSignaturePassenger(null) }}><section className="history-v2-signature-modal"><button className="close-small" onClick={() => setSignaturePassenger(null)}><X size={17} /></button><span className="eyebrow small">PASSENGER BOARDING RECORD</span><h3>Seat {signaturePassenger.seat_number}</h3><p>{signaturePassenger.employee_name} · {signaturePassenger.employee_number}</p><dl><dt>Boarded</dt><dd>{date(signaturePassenger.boarded_at)}</dd><dt>Stop</dt><dd>{signaturePassenger.boarding_stop_name || '—'}</dd></dl>{signaturePassenger.signature_data ? <img src={signaturePassenger.signature_data} alt={`${signaturePassenger.employee_name} signature`} /> : <div className="history-v2-empty">No signature was saved.</div>}</section></div>}</section>
}
