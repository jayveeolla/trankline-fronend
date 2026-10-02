import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, BusFront, Check, ChevronDown, CircleGauge, Expand, LocateFixed, MapPin, Pause, Play, Radio, Route as RouteIcon, Sparkles, Square, Target } from 'lucide-react'
import { api, type ApiRoute, type ApiRouteDetails, type ApiShuttle, type SessionUser } from '../../api'
import { DriverMap } from '../../DriverTracking'
import TripMessaging from '../../TripMessaging'

type Props = { shuttles: ApiShuttle[]; routes: ApiRoute[]; notify: (message: string) => void; user: SessionUser }
type DeviceLocation = { latitude: number; longitude: number; accuracy: number; speed: number; heading: number }

function formatOffset(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—'
  const minutes = Math.max(0, Math.round(Number(value)))
  if (minutes < 60) return `${minutes} min (est.)`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return `${hours}h${remainder ? ` ${remainder}m` : ''} (est.)`
}

function formatClock(value: Date) {
  return value.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })
}

export default function DriverGpsReferencePage({ shuttles, routes: _routes, notify, user }: Props) {
  const [selectedId, setSelectedId] = useState(shuttles[0]?.id || '')
  const [route, setRoute] = useState<ApiRouteDetails | null>(null)
  const [tripId, setTripId] = useState<number | null>(null)
  const [state, setState] = useState<'idle' | 'running' | 'paused' | 'ended'>('idle')
  const [location, setLocation] = useState<DeviceLocation | null>(null)
  const [nextStop, setNextStop] = useState('')
  const [error, setError] = useState('')
  const watchRef = useRef<number | null>(null)
  const lastSentRef = useRef(0)
  const selected = shuttles.find((shuttle) => shuttle.id === selectedId) || shuttles[0]

  const orderedStops = useMemo(() => route?.stops.filter((stop) => Number(stop.is_active) !== 0).slice().sort((a, b) => a.sequence - b.sequence) || [], [route])
  const nextStopIndex = Math.max(0, orderedStops.findIndex((stop) => stop.pickup_name === nextStop))
  const routeName = route?.route.route_name || route?.route.name || selected?.route || 'Calamba → TDK'
  const statusLabel = state === 'running' ? 'TRACKING' : state === 'paused' ? 'PAUSED' : state === 'ended' ? 'ENDED' : 'READY'

  useEffect(() => { if (!selectedId && shuttles[0]) setSelectedId(shuttles[0].id) }, [selectedId, shuttles])

  useEffect(() => {
    if (!selected?.route_id) { setRoute(null); return }
    let active = true
    api.route(selected.route_id).then((result) => {
      if (!active) return
      setRoute(result)
      const first = result.stops.filter((stop) => Number(stop.is_active) !== 0).sort((a, b) => a.sequence - b.sequence)[0]
      if (first) setNextStop((current) => current || first.pickup_name)
    }).catch(() => { if (active) setRoute(null) })
    return () => { active = false }
  }, [selected?.route_id])

  const stopWatching = () => {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current)
      watchRef.current = null
    }
  }

  const startWatching = (activeTripId: number) => {
    if (!navigator.geolocation) { setError('This phone/browser does not support GPS.'); return false }
    setError('Requesting phone GPS permission…')
    const options: PositionOptions = { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    const handlePosition = (position: GeolocationPosition) => {
      const next = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: Math.round(position.coords.accuracy), speed: Math.max(0, Math.round((position.coords.speed || 0) * 3.6)), heading: Math.max(0, position.coords.heading || 0) }
      setLocation(next)
      setError('')
      if (Date.now() - lastSentRef.current >= 4000) {
        lastSentRef.current = Date.now()
        void api.sendTripLocation(activeTripId, { ...next, timestamp: new Date().toISOString(), clientId: `${activeTripId}-${Date.now()}` }).then((result) => { if (result.nextStop) setNextStop(result.nextStop) }).catch(() => setError('GPS is live, but the latest location could not be sent.'))
      }
    }
    const handleError = (gpsError: GeolocationPositionError) => setError(gpsError.code === 1 ? 'Location permission was denied. Allow Location for this site, then tap Resume.' : 'Phone GPS is unavailable. Turn on Location/GPS and try again.')
    navigator.geolocation.getCurrentPosition(handlePosition, handleError, options)
    watchRef.current = navigator.geolocation.watchPosition(handlePosition, handleError, options)
    return true
  }

  useEffect(() => {
    api.activeDriverTrip().then(({ trip }) => {
      if (!trip) return
      setTripId(trip.id)
      setSelectedId(trip.shuttle_id)
      if (trip.latitude !== null && trip.latitude !== undefined && trip.longitude !== null && trip.longitude !== undefined) setLocation({ latitude: Number(trip.latitude), longitude: Number(trip.longitude), accuracy: 0, speed: Number(trip.speed) || 0, heading: Number(trip.heading) || 0 })
      if (trip.gps_state === 'PAUSED') setState('paused')
      else { setState('running'); startWatching(trip.id) }
    }).catch(() => { /* Admin accounts may not have an active driver trip. */ })
    return () => stopWatching()
  }, [])

  const start = async () => {
    if (!selected) return notify('No active shuttle is available.')
    if (!selected.route_id) return notify('Assign an incoming TDK route before starting a trip.')
    try {
      const result = await api.startTrip({ shuttleId: selected.id, routeId: selected.route_id })
      setTripId(result.trip.id)
      if (startWatching(result.trip.id)) setState('running')
      notify(`${selected.id} trip started; requesting phone GPS`)
    } catch (requestError) { notify(requestError instanceof Error ? requestError.message : 'Could not start trip') }
  }

  const pause = async () => {
    if (!tripId) return
    try { await api.pauseTrip(tripId); stopWatching(); setState('paused'); notify('Trip paused') } catch (requestError) { notify(requestError instanceof Error ? requestError.message : 'Could not pause trip') }
  }

  const resume = async () => {
    if (!tripId) return
    try { await api.resumeTrip(tripId); if (startWatching(tripId)) { setState('running'); notify('Trip resumed; GPS tracking is live again') } } catch (requestError) { notify(requestError instanceof Error ? requestError.message : 'Could not resume trip') }
  }

  const end = async () => {
    if (!tripId) return
    const reason = window.prompt('Reason for ending this trip (required):', 'Driver ended trip')?.trim()
    if (!reason) return notify('A reason is required before ending the trip.')
    stopWatching()
    try { await api.endTrip(tripId, reason); setState('ended'); notify('Trip closed and saved to trip history') } catch (requestError) { notify(requestError instanceof Error ? requestError.message : 'Could not end trip') }
  }

  const startLabel = route?.route.start_name || 'Calamba'
  const destinationLabel = route?.route.destination_name || 'TDK'
  const progressItems = [
    { key: 'start', label: startLabel, offset: null, kind: 'start' },
    ...orderedStops.map((stop) => ({ key: String(stop.stop_id), label: stop.pickup_name, offset: stop.estimated_arrival_offset, kind: 'stop' })),
    { key: 'destination', label: destinationLabel, offset: null, kind: 'end' },
  ]
  const liveTime = formatClock(new Date())

  return <section className="driver-page driver-reference-page">
    <header className="driver-reference-header">
      <div><span className="driver-reference-eyebrow"><i /> TRACKLINE WORKSPACE</span><h1>Driver GPS</h1><p>Broadcast live phone GPS for a shuttle trip headed to TDK.</p></div>
      <div className="driver-reference-header-actions"><div className="driver-reference-clock"><span><i /> Live Tracking</span><small>Oct 1, 2026&nbsp; {liveTime}</small></div></div>
    </header>

    <div className="driver-reference-layout">
      <aside className="driver-reference-sidebar">
        <section className="driver-reference-card driver-reference-setup">
          <div className="driver-step-heading"><b>1</b><div><h2>Trip setup</h2><p>Select the bus assigned to this phone.</p></div></div>
          <label className="driver-reference-label">Shuttle<select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}><option value="">Select shuttle</option>{shuttles.map((shuttle) => <option key={shuttle.id} value={shuttle.id}>{shuttle.id} · {shuttle.route || 'TDK route'}</option>)}</select><ChevronDown className="driver-select-icon" size={17} /></label>
          {selected && <div className="driver-vehicle-summary"><span className="driver-vehicle-icon"><BusFront size={48} /></span><div><strong>{selected.id}</strong><span>{selected.vehicle_name || selected.vehicle_type || 'Shuttle vehicle'}</span><small>Driver: {selected.driver || 'Assigned driver'}</small><small>Route: {routeName}</small></div></div>}
          <div className="driver-reference-actions">{state === 'idle' || state === 'ended' ? <button className="driver-primary-action" onClick={start}><Play size={18} /> Start trip</button> : state === 'running' ? <><button className="driver-secondary-action" onClick={pause}><Pause size={17} /> Pause</button><button className="driver-danger-action" onClick={end}><Square size={16} /> End trip</button></> : <><button className="driver-primary-action" onClick={resume}><Play size={17} /> Resume tracking</button><button className="driver-danger-action" onClick={end}><Square size={16} /> End trip</button></>}</div>
          {error && <p className="driver-reference-error">{error}</p>}
        </section>

        <section className="driver-reference-card">
          <div className="driver-step-heading driver-step-heading-inline"><b>2</b><div><h2>Live information</h2></div><span className={`driver-status-pill ${state}`}>{statusLabel}</span></div>
          <div className="driver-live-information"><div><LocateFixed size={22} /><span>Latitude</span><strong>{location ? location.latitude.toFixed(4) : '—'}</strong></div><div><LocateFixed size={22} /><span>Longitude</span><strong>{location ? location.longitude.toFixed(4) : '—'}</strong></div><div><CircleGauge size={22} /><span>Speed</span><strong>{location ? `${location.speed} km/h` : '—'}</strong></div><div><Target size={22} /><span>Accuracy</span><strong>{location ? `${location.accuracy} m` : '—'}</strong></div></div>
        </section>

        <section className="driver-reference-card driver-trip-status-card">
          <div className="driver-step-heading"><b>3</b><div><h2>Trip status</h2></div></div>
          <div className="driver-status-timeline"><div className="driver-status-row active"><span><Check size={13} /></span><strong>Trip started</strong><time>{state === 'running' || state === 'paused' || state === 'ended' ? 'Live' : '—'}</time></div><div className="driver-status-row"><span><Check size={13} /></span><strong>Arrived at TDK</strong><time>—</time></div><div className="driver-status-row"><span><Check size={13} /></span><strong>Trip completed</strong><time>{state === 'ended' ? 'Done' : '—'}</time></div></div>
        </section>
      </aside>

      <main className="driver-reference-main">
        <section className="driver-reference-card driver-reference-map-card">
          <header className="driver-reference-map-header"><div><h2><Radio size={18} /> Live driver map</h2><p>{routeName}</p></div><div className="driver-map-toolbar"><button onClick={() => notify('Map view selected')}><MapPin size={17} /> Map view <ChevronDown size={15} /></button><button onClick={() => notify('Use your browser controls to enter map fullscreen')} aria-label="Expand map"><Expand size={17} /></button></div></header>
          <div className="driver-reference-map-frame"><DriverMap location={location} route={route} nextStop={nextStop} reroutedGeometry={null} />{nextStop && <div className="driver-next-stop"><MapPin size={27} /><div><span>Next Stop</span><strong>{nextStop}</strong><small>{location ? 'GPS route active' : 'Waiting for GPS'} · {formatOffset(orderedStops.find((stop) => stop.pickup_name === nextStop)?.estimated_arrival_offset)}</small></div></div>}<div className="driver-map-legend"><span><i className="start" /> Start</span><span><i className="stop" /> Stop</span><span><i className="end" /> End</span><span><i className="route" /> Route</span><span><BusFront size={16} /> Bus (Live)</span></div></div>
        </section>

        <section className="driver-reference-card driver-route-progress"><div className="driver-progress-heading"><div><h2>Route progress</h2><p>Real-time progress of the current trip.</p></div><span><RouteIcon size={16} /> {orderedStops.length} pickup stops</span></div><div className="driver-progress-track">{progressItems.map((item, index) => { const passed = item.kind === 'start' ? state !== 'idle' : item.kind === 'end' ? state === 'ended' : index - 1 < nextStopIndex && state !== 'idle'; const current = item.kind === 'stop' && index - 1 === nextStopIndex && state !== 'idle'; return <div className={`driver-progress-stop ${passed ? 'passed' : ''} ${current ? 'current' : ''}`} key={item.key}><span className="driver-progress-node">{item.kind === 'start' ? <Play size={13} /> : item.kind === 'end' ? <Square size={12} /> : index}</span><strong>{item.label}</strong><small>{item.kind === 'start' ? (state !== 'idle' ? 'Departed' : 'Ready') : item.kind === 'end' ? 'TDK destination' : current ? 'Up next' : passed ? 'Passed' : formatOffset(item.offset)}</small></div> })}</div></section>
      </main>
    </div>

    {selected && <div className="driver-reference-messaging"><TripMessaging shuttleId={selected.id} routeName={routeName} routeStops={route?.stops} user={user} notify={notify} /></div>}
  </section>
}
