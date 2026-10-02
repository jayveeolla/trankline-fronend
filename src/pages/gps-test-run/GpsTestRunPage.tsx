import { useEffect, useMemo, useState } from 'react'
import { Activity, BusFront, Pause, Play, Square } from 'lucide-react'
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { api, type ApiDriver, type ApiRoute, type ApiRouteDetails, type ApiSchedule, type ApiShuttle, type ApiTrip, type SimulationSnapshot } from '../../api'
import { getRealtimeSocket } from '../../realtime'

const simulationBusIcon = L.divIcon({ className: 'simulation-bus-icon', html: '<span>BUS</span>', iconSize: [52, 36], iconAnchor: [26, 18] })
const simulationStopIcon = (sequence: number, name: string, state: 'upcoming' | 'passed' | 'next') => L.divIcon({ className: `simulation-stop-icon ${state}`, html: `<div><strong>${state === 'next' ? 'NEXT · ' : ''}${sequence}. ${name}</strong><span><b>${sequence}</b></span></div>`, iconSize: [170, 64], iconAnchor: [85, 64] })
const simulationDestinationIcon = L.divIcon({ className: 'simulation-destination-icon', html: '<span>★</span><strong>TDK</strong>', iconSize: [48, 42], iconAnchor: [24, 35] })

function SimulationMapFollow({ snapshot }: { snapshot: SimulationSnapshot | null }) {
  const map = useMap()
  useEffect(() => { if (snapshot) map.setView([snapshot.latitude, snapshot.longitude], Math.max(map.getZoom(), 13), { animate: true }) }, [map, snapshot?.latitude, snapshot?.longitude])
  return null
}

function SimulationMap({ route, snapshot }: { route: ApiRouteDetails | null; snapshot: SimulationSnapshot | null }) {
  const geometry = route?.route.route_geometry ? (() => { try { const value = typeof route.route.route_geometry === 'string' ? JSON.parse(route.route.route_geometry) : route.route.route_geometry; return Array.isArray(value) ? value as [number, number][] : [] } catch { return [] } })() : []
  const center: [number, number] = snapshot ? [snapshot.latitude, snapshot.longitude] : geometry[0] || [14.2724796, 121.0632645]
  const completedStops = snapshot?.completedStops || 0
  const nextStop = snapshot?.nextStop
  return <MapContainer className="simulation-map" center={center} zoom={13} scrollWheelZoom style={{ width: '100%', height: '100%' }}><TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><SimulationMapFollow snapshot={snapshot} />{geometry.length > 1 && <Polyline positions={geometry} pathOptions={{ color: '#247ff0', weight: 6, opacity: .9 }} />}{route?.stops.filter((stop) => Number(stop.is_active) !== 0).slice().sort((a, b) => a.sequence - b.sequence).map((stop, index) => { const state = stop.pickup_name === nextStop ? 'next' : index < completedStops ? 'passed' : 'upcoming'; return <Marker key={stop.stop_id} position={[Number(stop.latitude), Number(stop.longitude)]} icon={simulationStopIcon(stop.sequence, stop.pickup_name, state)} /> })}{route?.route.destination_latitude !== null && route?.route.destination_latitude !== undefined && route?.route.destination_longitude !== null && route?.route.destination_longitude !== undefined && <Marker position={[Number(route.route.destination_latitude), Number(route.route.destination_longitude)]} icon={simulationDestinationIcon} />} {snapshot && <Marker position={[snapshot.latitude, snapshot.longitude]} icon={simulationBusIcon} />}</MapContainer>
}

function SimulationPanelBody({ routes: allRoutes, shuttles, notify }: { routes: ApiRoute[]; shuttles: ApiShuttle[]; notify: (message: string) => void }) {
  const simulationRoutes = useMemo(() => allRoutes.filter((item) => Number(item.is_active) === 1 && Boolean(item.route_geometry)), [allRoutes])
  const routes = simulationRoutes
  const [drivers, setDrivers] = useState<ApiDriver[]>([])
  const [schedules, setSchedules] = useState<ApiSchedule[]>([])
  const [routeId, setRouteId] = useState<number>(simulationRoutes[0]?.id || 0)
  const [shuttleId, setShuttleId] = useState(shuttles[0]?.id || '')
  const [driverId, setDriverId] = useState<number | ''>('')
  const [scheduleId, setScheduleId] = useState<number | ''>('')
  const [speedKmh, setSpeedKmh] = useState(35)
  const [multiplier, setMultiplier] = useState(1)
  const [route, setRoute] = useState<ApiRouteDetails | null>(null)
  const [snapshot, setSnapshot] = useState<SimulationSnapshot | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => { if (!shuttleId && shuttles[0]) setShuttleId(shuttles[0].id) }, [shuttleId, shuttles])
  useEffect(() => { if (!simulationRoutes.some((item) => item.id === routeId)) setRouteId(simulationRoutes[0]?.id || 0) }, [routeId, simulationRoutes])
  useEffect(() => { api.drivers().then((result) => setDrivers(result.drivers)).catch(() => setDrivers([])); api.schedules().then((result) => setSchedules(result.schedules)).catch(() => setSchedules([])); api.activeSimulation().then((result) => { if (result.simulation) { setSnapshot(result.simulation); setRouteId(result.simulation.routeId); setShuttleId(result.simulation.shuttleId) } }).catch(() => undefined) }, [])
  useEffect(() => { setMessage(''); setRoute(null); if (routeId) api.route(routeId).then(setRoute).catch(() => setRoute(null)) }, [routeId])
  useEffect(() => { const socket = getRealtimeSocket(); socket.on('simulation:update', (value: SimulationSnapshot) => setSnapshot((current) => !current || current.tripId === value.tripId ? value : current)); socket.on('simulation:error', (value: { tripId: number; message: string }) => { setMessage(value.message); setSnapshot(null) }); socket.on('trip:completed', (trip: ApiTrip) => { if (trip.trip_mode === 'SIMULATION') setSnapshot((current) => current && current.tripId === trip.id ? { ...current, status: 'COMPLETED', progress: 100 } : current) }); return () => { /* shared connection is owned by Dashboard */ } }, [])
  const selectedShuttle = shuttles.find((shuttle) => shuttle.id === shuttleId)
  const active = Boolean(snapshot && snapshot.status !== 'COMPLETED')
  const startRun = async (restartRun = false) => { setMessage(''); try { const result = await api.startSimulation({ shuttleId, routeId, driverId: driverId || null, scheduleId: scheduleId || null, speedKmh, multiplier, restart: restartRun }); setSnapshot(result.simulation); notify(restartRun ? `${result.trip.trip_code} restarted as SIMULATED GPS` : `${result.trip.trip_code} started as SIMULATED GPS`) } catch (error) { const errorMessage = error instanceof Error ? error.message : 'Could not start Test Run.'; if (!restartRun && (errorMessage.includes('already has an active trip') || errorMessage.includes('already has an active GPS test run'))) { try { const result = await api.startSimulation({ shuttleId, routeId, driverId: driverId || null, scheduleId: scheduleId || null, speedKmh, multiplier, restart: true }); setSnapshot(result.simulation); notify(`${result.trip.trip_code} restarted as SIMULATED GPS`) } catch (restartError) { setMessage(restartError instanceof Error ? restartError.message : errorMessage) } } else setMessage(errorMessage) } }
  const start = () => { void startRun() }
  const pause = async () => { if (!snapshot) return; try { const result = await api.pauseSimulation(snapshot.tripId); setSnapshot(result.simulation) } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not pause simulation.') } }
  const resume = async () => { if (!snapshot) return; try { const result = await api.resumeSimulation(snapshot.tripId); setSnapshot(result.simulation) } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not resume simulation.') } }
  const stop = async () => { if (!snapshot) return; try { await api.stopSimulation(snapshot.tripId); setSnapshot(null); notify('GPS Test Run stopped') } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not stop simulation.') } }
  const formatDistance = (meters: number) => meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`
  const formatEta = (minutes?: number | null) => minutes === null || minutes === undefined ? '—' : `${minutes} min`
  return <div className="simulation-workspace"><div className="simulation-banner"><div><span className="eyebrow"><span className="pulse-dot" /> ADMIN DEVELOPMENT TOOL</span><h3>GPS Test Run</h3><p>Simulate a real trip using the saved route geometry. This never requests phone GPS.</p></div><span className="simulation-badge">SIMULATED GPS ONLY</span></div><div className="simulation-layout"><div className="simulation-setup"><div className="simulation-card-heading"><Activity size={18} /><div><strong>Test run setup</strong><span>Database route, shuttle, stops, and driver</span></div></div><label className="wizard-field"><span>Shuttle</span><select value={shuttleId} disabled={active} onChange={(event) => setShuttleId(event.target.value)}>{shuttles.map((shuttle) => <option key={shuttle.id} value={shuttle.id}>{shuttle.id} · {shuttle.route || shuttle.vehicle_name || 'Unassigned'}</option>)}</select></label><label className="wizard-field"><span>Route</span><select value={routeId} disabled={active} onChange={(event) => setRouteId(Number(event.target.value))}>{routes.map((item) => <option key={item.id} value={item.id}>{item.route_name || item.name}</option>)}</select></label><label className="wizard-field"><span>Test driver</span><select value={driverId} disabled={active} onChange={(event) => setDriverId(event.target.value ? Number(event.target.value) : '')}><option value="">No driver / admin test</option>{drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.driver_name} · {driver.employee_number}</option>)}</select></label><label className="wizard-field"><span>Schedule (optional)</span><select value={scheduleId} disabled={active} onChange={(event) => setScheduleId(event.target.value ? Number(event.target.value) : '')}><option value="">No schedule</option>{schedules.filter((item) => Number(item.route_id) === Number(routeId)).map((schedule) => <option key={schedule.id} value={schedule.id}>{schedule.departure_time} · {schedule.route_name || 'Route schedule'}</option>)}</select></label><div className="simulation-speed-row"><label className="wizard-field"><span>Vehicle speed (not playback)</span><input type="number" min="5" max="100" value={speedKmh} disabled={active} onChange={(event) => setSpeedKmh(Number(event.target.value) || 35)} /></label><div className="wizard-field"><span>Playback multiplier</span><div className="simulation-speed-buttons">{[1, 2, 5, 10, 20].map((value) => <button key={value} className={multiplier === value ? 'active' : ''} disabled={active} onClick={() => setMultiplier(value)}>{value}x</button>)}</div></div></div>{message && <div className="wizard-message">{message}</div>}{!active ? <button className="primary-button simulation-start" disabled={!route?.route.route_geometry || !selectedShuttle} onClick={start}><Play size={15} /> Start Test Run</button> : <div className="simulation-actions"><button className="secondary-button" onClick={snapshot?.status === 'PAUSED' ? resume : pause}>{snapshot?.status === 'PAUSED' ? <Play size={15} /> : <Pause size={15} />}{snapshot?.status === 'PAUSED' ? 'Resume' : 'Pause'}</button><button className="secondary-button danger" onClick={stop}><Square size={14} /> Stop test</button></div>}<small className="simulation-safety">TEST ONLY · The trip is stored separately as <strong>SIMULATION</strong>.</small></div><div className="simulation-map-card"><div className="simulation-map-heading"><div><strong>Live simulated driver map</strong><span>{route?.route.route_name || 'Select a database route'}</span></div><span className="simulation-badge">{snapshot ? snapshot.status : 'READY'}</span></div><div className="simulation-map-frame">{route ? <SimulationMap route={route} snapshot={snapshot} /> : <div className="empty-state">Select a route to load its saved road geometry.</div>}</div></div></div>{snapshot && <div className="simulation-stats"><div><span>Trip code</span><strong>{snapshot.tripCode}</strong></div><div><span>GPS source</span><strong>SIMULATION</strong></div><div><span>Vehicle speed</span><strong>{snapshot.speedKmh} km/h</strong></div><div><span>Playback</span><strong>{snapshot.multiplier}x</strong></div><div><span>Next stop</span><strong>{snapshot.nextStop || 'TDK'}</strong></div><div><span>ETA next stop</span><strong>{formatEta(snapshot.etaNextStopMinutes)}</strong></div><div><span>ETA TDK</span><strong>{formatEta(snapshot.etaTdkMinutes)}</strong></div><div><span>Progress</span><strong>{snapshot.progress}%</strong></div><div><span>Distance to next</span><strong>{formatDistance(snapshot.distanceToNextStopMeters)}</strong></div><div><span>Remaining route</span><strong>{formatDistance(snapshot.remainingDistanceMeters)}</strong></div><div><span>Stops</span><strong>{snapshot.completedStops} / {snapshot.totalStops}</strong></div><div><span>GPS points</span><strong>{snapshot.gpsPointsGenerated}</strong></div></div>}</div>
}

export default function GpsTestRunPage({ routes, shuttles, notify }: { routes: ApiRoute[]; shuttles: ApiShuttle[]; notify: (message: string) => void }) {
  return <><ActiveTripControls notify={notify} /><SimulationPanelBody routes={routes} shuttles={shuttles} notify={notify} /></>
}

export function ActiveTripControls({ notify }: { notify: (message: string) => void }) {
  const [trips, setTrips] = useState<ApiTrip[]>([])
  const [endingId, setEndingId] = useState<number | null>(null)
  const activeStatuses = ['NOT_STARTED', 'EN_ROUTE', 'APPROACHING_STOP', 'AT_PICKUP_POINT', 'HEADING_TO_TDK', 'PAUSED']
  const load = async () => {
    try { const result = await api.trips(); setTrips(result.trips.filter((trip) => activeStatuses.includes(trip.status))) } catch (error) { notify(error instanceof Error ? error.message : 'Could not load active trips') }
  }
  useEffect(() => { void load() }, [])
  const endTrip = async (trip: ApiTrip) => {
    const reason = window.prompt(`Reason for ending ${trip.trip_code || trip.shuttle_id}:`, 'Admin ended active trip')?.trim()
    if (!reason) return
    setEndingId(trip.id)
    try { await api.endTrip(trip.id, reason); notify(`${trip.shuttle_id} ended and is ready for a new trip`); await load() } catch (error) { notify(error instanceof Error ? error.message : 'Could not end active trip') } finally { setEndingId(null) }
  }
  if (!trips.length) return null
  return <div className="active-trip-controls"><div className="active-trip-controls-heading"><div><span className="eyebrow small">ACTIVE TRIPS</span><h3>End an active trip</h3><p>Use this recovery action when a trip was left running and you need to start the shuttle again.</p></div><span className="setting-status live"><i />{trips.length} active</span></div>{trips.map((trip) => <div className="active-trip-row" key={trip.id}><div className="bus-mini blue-bus"><BusFront size={17} /></div><div><strong>{trip.trip_code || `Trip ${trip.id}`}</strong><span>{trip.shuttle_id} · {trip.route_name || 'Incoming route'} · {trip.status}</span></div><button className="secondary-button danger compact" disabled={endingId === trip.id} onClick={() => void endTrip(trip)}>{endingId === trip.id ? 'Ending…' : 'End trip'}</button></div>)}</div>
}
