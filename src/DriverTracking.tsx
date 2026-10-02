import { useEffect, useMemo, useRef, useState } from 'react'
import { BusFront, LocateFixed, MapPin, Pause, Play, Radio, Square } from 'lucide-react'
import { Circle, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import { api, type ApiRoute, type ApiRouteDetails, type ApiShuttle, type SessionUser } from './api'
import TripMessaging from './TripMessaging'
import { distanceToRouteMeters, parseRouteGeometry, routeWaypoints, type Coordinate } from './routeUtils'

type Props = { shuttles: ApiShuttle[]; routes: ApiRoute[]; notify: (message: string) => void; user: SessionUser }
type DeviceLocation = { latitude: number; longitude: number; accuracy: number; speed: number; heading: number }
type GpsPacket = DeviceLocation & { timestamp: string; clientId: string }

const driverIcon = L.divIcon({ className: 'driver-live-icon', html: '<span>BUS</span>', iconSize: [46, 34], iconAnchor: [23, 17] })
const stopIcon = (sequence: number, isNext = false) => L.divIcon({ className: `driver-stop-icon${isNext ? ' next' : ''}`, html: `<span><b>${sequence}</b></span>`, iconSize: [30, 36], iconAnchor: [15, 30] })

function DriverMapController({ location, points }: { location: DeviceLocation | null; points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (location) map.setView([location.latitude, location.longitude], Math.max(map.getZoom(), 14), { animate: true })
    else if (points.length > 1) map.fitBounds(points, { padding: [30, 30], maxZoom: 15, animate: false })
  }, [location, map, points])
  return null
}

export function DriverMap({ location, route, nextStop, reroutedGeometry }: { location: DeviceLocation | null; route: ApiRouteDetails | null; nextStop: string; reroutedGeometry: Coordinate[] | null }) {
  const orderedStops = useMemo(() => route?.stops.filter((stop) => Number(stop.is_active) !== 0).slice().sort((a, b) => a.sequence - b.sequence) || [], [route])
  const points = useMemo<[number, number][]>(() => {
    if (!route) return []
    if (reroutedGeometry && reroutedGeometry.length > 1) return reroutedGeometry
    if (route.route.route_geometry) {
      try { const geometry = typeof route.route.route_geometry === 'string' ? JSON.parse(route.route.route_geometry) : route.route.route_geometry; if (Array.isArray(geometry)) return geometry } catch { /* use stops below */ }
    }
    return [
      ...(route.route.start_latitude !== null && route.route.start_latitude !== undefined && route.route.start_longitude !== null && route.route.start_longitude !== undefined ? [[Number(route.route.start_latitude), Number(route.route.start_longitude)] as [number, number]] : []),
      ...route.stops.filter((stop) => Number(stop.is_active) !== 0).slice().sort((a, b) => a.sequence - b.sequence).map((stop) => [Number(stop.latitude), Number(stop.longitude)] as [number, number]),
      ...(route.route.destination_latitude !== null && route.route.destination_latitude !== undefined && route.route.destination_longitude !== null && route.route.destination_longitude !== undefined ? [[Number(route.route.destination_latitude), Number(route.route.destination_longitude)] as [number, number]] : []),
    ]
  }, [route, reroutedGeometry])
  const center: [number, number] = location ? [location.latitude, location.longitude] : points[0] || [12.8797, 121.774]
  const nextStopRecord = orderedStops.find((stop) => stop.pickup_name === nextStop) || orderedStops[0]
  return <MapContainer className="driver-map" center={center} zoom={location ? 14 : 13} minZoom={8} maxZoom={19} scrollWheelZoom style={{ width: '100%', height: '100%' }}><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" subdomains={['a', 'b', 'c']} /><DriverMapController location={location} points={points} />{points.length > 1 && <Polyline positions={points} pathOptions={{ color: '#247ff0', weight: 6, opacity: .85 }} />}{orderedStops.map((stop) => { const isNext = Boolean(nextStopRecord && stop.stop_id === nextStopRecord.stop_id); return <Marker key={stop.stop_id} position={[Number(stop.latitude), Number(stop.longitude)]} icon={stopIcon(stop.sequence, isNext)}><Tooltip direction="top" offset={[0, -24]} permanent>{isNext ? `NEXT · ${stop.sequence}. ${stop.pickup_name}` : `${stop.sequence}. ${stop.pickup_name}`}</Tooltip></Marker> })}{location && <><Circle center={[location.latitude, location.longitude]} radius={Math.max(location.accuracy, 15)} pathOptions={{ color: '#20a66e', fillColor: '#20a66e', fillOpacity: .15 }} /><Marker position={[location.latitude, location.longitude]} icon={driverIcon} /></>}</MapContainer>
}

export default function DriverTracking({ shuttles, routes, notify, user }: Props) {
  const [selectedId, setSelectedId] = useState(shuttles[0]?.id || '')
  const [route, setRoute] = useState<ApiRouteDetails | null>(null)
  const [reroutedGeometry, setReroutedGeometry] = useState<Coordinate[] | null>(null)
  const [tripId, setTripId] = useState<number | null>(null)
  const [state, setState] = useState<'idle' | 'running' | 'paused' | 'ended'>('idle')
  const [location, setLocation] = useState<DeviceLocation | null>(null)
  const [nextStop, setNextStop] = useState('')
  const [error, setError] = useState('')
  const [queuedCount, setQueuedCount] = useState(0)
  const watchRef = useRef<number | null>(null)
  const lastSentRef = useRef(0)
  const rerouteSignature = useRef('')
  const selected = shuttles.find((shuttle) => shuttle.id === selectedId) || shuttles[0]

  useEffect(() => { if (!selectedId && shuttles[0]) setSelectedId(shuttles[0].id) }, [selectedId, shuttles])

  const queueKey = (activeTripId: number) => `trackline-gps-queue:${activeTripId}`
  const trackingIntentKey = (activeTripId: number) => `trackline-trip-intent:${activeTripId}`
  const readQueue = (activeTripId: number): GpsPacket[] => { try { return JSON.parse(window.localStorage.getItem(queueKey(activeTripId)) || '[]') } catch { return [] } }
  const writeQueue = (activeTripId: number, packets: GpsPacket[]) => { if (packets.length) window.localStorage.setItem(queueKey(activeTripId), JSON.stringify(packets)); else window.localStorage.removeItem(queueKey(activeTripId)); setQueuedCount(packets.length) }
  const sendOrQueue = async (activeTripId: number, packet: GpsPacket) => {
    const pending = [...readQueue(activeTripId), packet]
    const remaining: GpsPacket[] = []
    for (let index = 0; index < pending.length; index += 1) {
      try { const result = await api.sendTripLocation(activeTripId, pending[index]); if (result.nextStop) setNextStop(result.nextStop) } catch { remaining.push(...pending.slice(index)); break }
    }
    writeQueue(activeTripId, remaining)
  }

  useEffect(() => {
    setReroutedGeometry(null)
    rerouteSignature.current = ''
    if (!selected?.route_id) { setRoute(null); return }
    let active = true
    api.route(selected.route_id).then((result) => { if (active) { setRoute(result); const firstStop = result.stops.slice().sort((a, b) => a.sequence - b.sequence)[0]; if (firstStop) setNextStop((current) => current || firstStop.pickup_name) } }).catch(() => { if (active) setRoute(null) })
    return () => { active = false }
  }, [selected?.route_id])

  useEffect(() => {
    if (!location || !route) return
    const savedGeometry = parseRouteGeometry(route.route.route_geometry)
    if (savedGeometry.length < 2 || distanceToRouteMeters([location.latitude, location.longitude], savedGeometry) <= 120) return
    const destination: Coordinate = [Number(route.route.destination_latitude), Number(route.route.destination_longitude)]
    if (!Number.isFinite(destination[0]) || !Number.isFinite(destination[1])) return
    const stops = route.stops.filter((stop) => Number(stop.is_active) !== 0).map((stop) => ({ pickup_name: stop.pickup_name, latitude: Number(stop.latitude), longitude: Number(stop.longitude), sequence: stop.sequence }))
    const signature = `${route.route.id}:${nextStop || stops[0]?.pickup_name || 'route'}`
    if (rerouteSignature.current === signature) return
    rerouteSignature.current = signature
    let active = true
    api.routeGeometry(routeWaypoints([location.latitude, location.longitude], stops, destination, nextStop)).then((result) => {
      if (active) setReroutedGeometry(result.geometry)
    }).catch(() => { if (active) rerouteSignature.current = '' })
    return () => { active = false }
  }, [location, nextStop, route])

  useEffect(() => {
    api.activeDriverTrip().then(({ trip }) => {
      if (!trip) return
      setTripId(trip.id)
      setSelectedId(trip.shuttle_id)
      setQueuedCount(readQueue(trip.id).length)
      if (trip.route_id) api.route(trip.route_id).then((result) => { const firstStop = result.stops.slice().sort((a, b) => a.sequence - b.sequence)[0]; if (firstStop) setNextStop(firstStop.pickup_name) }).catch(() => { /* route map will remain available when loaded */ })
      if (trip.latitude !== null && trip.latitude !== undefined && trip.longitude !== null && trip.longitude !== undefined) setLocation({ latitude: Number(trip.latitude), longitude: Number(trip.longitude), accuracy: 0, speed: Number(trip.speed) || 0, heading: Number(trip.heading) || 0 })
      const savedIntent = window.localStorage.getItem(trackingIntentKey(trip.id))
      if (trip.gps_state === 'PAUSED' && savedIntent === 'LIVE') {
        setState('paused')
        void api.resumeTrip(trip.id).then(({ trip: resumedTrip }) => {
          if (resumedTrip.gps_state === 'PAUSED') return
          window.localStorage.setItem(trackingIntentKey(trip.id), 'LIVE')
          const gpsStarted = startWatching(trip.id)
          setState(gpsStarted ? 'running' : 'paused')
        }).catch(() => { window.localStorage.setItem(trackingIntentKey(trip.id), 'PAUSED') })
      } else if (trip.gps_state === 'PAUSED') {
        setState('paused')
        notify(`Active trip found: ${trip.trip_code || `Trip ${trip.id}`}. This trip is paused.`)
      } else {
        const gpsStarted = startWatching(trip.id)
        setState(gpsStarted ? 'running' : 'paused')
        notify(gpsStarted ? `Active trip found: ${trip.trip_code || `Trip ${trip.id}`}. GPS tracking resumed automatically.` : `Active trip found: ${trip.trip_code || `Trip ${trip.id}`}. Allow GPS permission to continue tracking.`)
      }
    }).catch(() => { /* Admin accounts do not have a driver resume endpoint. */ })
  }, [])

  useEffect(() => {
    const flush = () => { if (tripId && location) void sendOrQueue(tripId, { latitude: location.latitude, longitude: location.longitude, accuracy: location.accuracy, speed: location.speed, heading: location.heading, timestamp: new Date().toISOString(), clientId: `flush-${tripId}-${Date.now()}` }) }
    window.addEventListener('online', flush)
    return () => window.removeEventListener('online', flush)
  }, [tripId, location])

  const stopWatching = () => { if (watchRef.current !== null) { navigator.geolocation.clearWatch(watchRef.current); watchRef.current = null } }
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
        void sendOrQueue(activeTripId, { ...next, timestamp: new Date().toISOString(), clientId: `${activeTripId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` })
      }
    }
    const handleError = (gpsError: GeolocationPositionError) => {
      const message = gpsError.code === 1 ? 'Location permission was denied. Allow Location for this site, then tap Resume tracking again.' : gpsError.code === 2 ? 'Phone GPS is unavailable. Turn on Location/GPS and try again.' : 'GPS request timed out. Move near a window or outdoors and try again.'
      setError(message)
    }
    navigator.geolocation.getCurrentPosition(handlePosition, handleError, options)
    watchRef.current = navigator.geolocation.watchPosition(handlePosition, handleError, options)
    return true
  }

  useEffect(() => () => stopWatching(), [])

  const start = async () => {
    if (!selected) return notify('No active shuttle is available.')
    if (!selected.route_id) return notify('Assign an incoming TDK route before starting a trip.')
    try { const result = await api.startTrip({ shuttleId: selected.id, routeId: selected.route_id }); setTripId(result.trip.id); window.localStorage.setItem(trackingIntentKey(result.trip.id), 'LIVE'); if (startWatching(result.trip.id)) setState('running'); notify(`${selected.id} trip started; requesting phone GPS`) } catch (requestError) { notify(requestError instanceof Error ? requestError.message : 'Could not start trip') }
  }
  const pause = async () => {
    if (!tripId) return
    window.localStorage.setItem(trackingIntentKey(tripId), 'PAUSED')
    try { await api.pauseTrip(tripId); stopWatching(); setState('paused'); notify('Trip paused; shuttle is marked Paused in live tracking') } catch (requestError) { window.localStorage.setItem(trackingIntentKey(tripId), 'LIVE'); notify(requestError instanceof Error ? requestError.message : 'Could not pause trip') }
  }
  const resume = async () => {
    if (!tripId) return
    window.localStorage.setItem(trackingIntentKey(tripId), 'LIVE')
    try { await api.resumeTrip(tripId); if (startWatching(tripId)) { setState('running'); notify('Trip resumed; GPS tracking is live again') } } catch (requestError) { window.localStorage.setItem(trackingIntentKey(tripId), 'PAUSED'); notify(requestError instanceof Error ? requestError.message : 'Could not resume trip') }
  }
  const end = async () => {
    if (!tripId) return
    const reason = window.prompt('Reason for ending this trip (required):', 'Driver ended trip')?.trim()
    if (!reason) return notify('A reason is required before ending the trip.')
    stopWatching()
    try { await api.endTrip(tripId, reason); window.localStorage.removeItem(trackingIntentKey(tripId)); notify('Trip closed and saved to trip history'); setState('ended') } catch (requestError) { notify(requestError instanceof Error ? requestError.message : 'Could not end trip') }
  }

  return <section className="driver-page"><div className="page-heading workspace-page-heading"><div><div className="eyebrow"><span className="pulse-dot" /> DRIVER GPS TRACKING</div><h1>Driver phone tracker</h1><p>Keep this tracking screen active during the trip for reliable location updates.</p></div><span className={`driver-state ${state}`}><i />{state === 'running' ? 'GPS LIVE' : state === 'paused' ? 'ACTIVE TRIP FOUND' : state === 'ended' ? 'TRIP ENDED' : 'READY'}</span></div><div className="driver-layout"><div className="driver-control-card"><div className="driver-card-heading"><div className="resource-icon blue"><BusFront size={18} /></div><div><strong>Trip setup</strong><span>Select the bus assigned to this phone.</span></div></div><label className="wizard-field"><span>Shuttle</span><select value={selected?.id || ''} disabled={state === 'running' || state === 'paused'} onChange={(event) => setSelectedId(event.target.value)}>{shuttles.map((shuttle) => <option value={shuttle.id} key={shuttle.id}>{shuttle.id} · {shuttle.route || 'Unassigned'}</option>)}</select></label>{selected && <div className="driver-route-summary"><strong>{selected.route || 'No route assigned'}</strong><span>{selected.driver || 'Driver account'} · {selected.plate_number || 'No plate number'}</span><span>Destination: TDK</span></div>}<div className="driver-actions">{state === 'idle' || state === 'ended' ? <button className="primary-button" onClick={start}><Play size={15} /> Start trip</button> : null}{state === 'running' ? <button className="secondary-button" onClick={pause}><Pause size={15} /> Pause tracking</button> : null}{state === 'paused' ? <button className="primary-button" onClick={resume}><Play size={15} /> Resume tracking</button> : null}{(state === 'running' || state === 'paused') && <button className="secondary-button danger" onClick={end}><Square size={14} /> End trip</button>}</div>{queuedCount > 0 && <div className="wizard-message">{queuedCount} GPS point(s) queued until internet returns.</div>}{error && <div className="wizard-message">{error}</div>}<div className="driver-live-stats"><div><span>Latitude</span><strong>{location ? location.latitude.toFixed(6) : '—'}</strong></div><div><span>Longitude</span><strong>{location ? location.longitude.toFixed(6) : '—'}</strong></div><div><span>Speed</span><strong>{location ? `${location.speed} km/h` : '—'}</strong></div><div><span>Accuracy</span><strong>{location ? `±${location.accuracy} m` : '—'}</strong></div></div></div><div className="driver-map-card"><div className="driver-map-header"><div><strong><Radio size={15} /> Live driver map</strong><span>{route?.route.route_name || selected?.route || 'Select a route'}</span></div><span><LocateFixed size={14} /> {location ? 'Phone location live' : 'Waiting for GPS'}</span></div><div className="driver-map-frame"><DriverMap location={location} route={route} nextStop={nextStop} reroutedGeometry={reroutedGeometry} /></div></div></div><TripMessaging shuttleId={selected?.id || ''} routeName={selected?.route || 'Select a route'} routeStops={route?.stops || []} user={user} notify={notify} /></section>
}
