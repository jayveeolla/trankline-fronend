import React from 'react'
import { Activity, BusFront, ChevronDown, Clock3, Crosshair, Gauge, Layers3, LocateFixed, MoreHorizontal, Navigation, Pause, Play, Radio, Route, ShieldCheck, Signal, SlidersHorizontal, Sparkles, Square, X, Zap } from 'lucide-react'
import RealCampusMap, { type MapRequest, type MapShuttle, type UserLocation } from '../../RealMap'
import TripMessaging from '../../TripMessaging'
import SeatBoarding from '../../SeatBoarding'
import type { ApiRouteDetails, SessionUser } from '../../api'

type LiveTrackingPageProps = {
  user: SessionUser
  notify: (message: string) => void
  showSimulator: boolean
  setShowSimulator: (value: boolean) => void
  shareLiveView: () => Promise<void>
  routeStats: { live: number; minutes: string }
  shuttles: Array<{ status: string }>
  selectedRouteDetails: ApiRouteDetails | null
  simState: 'idle' | 'running' | 'paused'
  simSpeed: number
  setSimSpeed: (value: number) => void
  selected: MapShuttle
  startSimulation: () => void
  setSimState: (value: 'idle' | 'running' | 'paused') => void
  stopSimulation: () => void
  isFocused: boolean
  gpsState: 'requesting' | 'live' | 'denied' | 'unavailable' | 'demo'
  gpsMessage: string
  locateMe: () => void
  liveShuttles: MapShuttle[]
  nearbyShuttles: MapShuttle[]
  selectedId: string
  setSelectedId: (value: string) => void
  mapRequest: MapRequest
  setMapRequest: (value: MapRequest) => void
  userLocation: UserLocation | null
  mapRouteDetails: ApiRouteDetails | null
  trackSelected: () => void
  viewFullRoute: () => void
  visibleStops: Array<{ name: string; eta: string; state: string }>
}

export default function LiveTrackingPage({ user, notify, showSimulator, setShowSimulator, shareLiveView, routeStats, shuttles, selectedRouteDetails, simState, simSpeed, setSimSpeed, selected, startSimulation, setSimState, stopSimulation, isFocused, gpsState, gpsMessage, locateMe, liveShuttles, nearbyShuttles, selectedId, setSelectedId, mapRequest, setMapRequest, userLocation, mapRouteDetails, trackSelected, viewFullRoute, visibleStops }: LiveTrackingPageProps) {
  return <>
<div className="page-heading">
            <div>
              <div className="eyebrow"><span className="pulse-dot" /> LIVE FLEET OVERVIEW</div>
              <h1>Live tracking</h1>
              <p>See every shuttle moving across campus in real time.</p>
            </div>
            <div className="heading-actions">
              <button className="secondary-button" onClick={() => setShowSimulator(!showSimulator)}><Activity size={16} /> GPS simulator</button>
              <button className="primary-button" onClick={() => { void shareLiveView() }}><Signal size={16} /> Share live view</button>
            </div>
          </div>

          <div className="metric-row">
            <Metric icon={<BusFront size={18} />} label="Active shuttles" value={`${routeStats.live}`} detail="All systems normal" tone="blue" />
            <Metric icon={<Radio size={18} />} label="Live GPS feeds" value={`${shuttles.filter((shuttle) => shuttle.status !== 'Paused').length} / ${shuttles.length}`} detail="Database fleet status" tone="green" />
            <Metric icon={<Clock3 size={18} />} label="Estimated ETA" value={routeStats.minutes === '—' ? '—' : `${routeStats.minutes} min`} detail={`Across ${selectedRouteDetails?.stops.length || 0} route stops`} tone="purple" />
            <Metric icon={<Zap size={18} />} label="Service status" value="On time" detail="No delays reported" tone="yellow" />
          </div>

          {showSimulator && <SimulatorPanel simState={simState} simSpeed={simSpeed} setSimSpeed={setSimSpeed} vehicleId={selected.id} routeName={selected.route} start={startSimulation} pause={() => setSimState('paused')} resume={() => setSimState('running')} stop={stopSimulation} close={() => setShowSimulator(false)} />}

          <section className={`tracking-layout ${isFocused ? 'focused' : ''}`}>
            <div className="map-card">
              <div className="map-toolbar">
                <div className="map-title"><div className="map-title-icon"><Layers3 size={17} /></div><div><strong>Live campus map</strong><span>GPS route view · live shuttle positions</span></div></div>
                <div className="map-tools"><span className={`gps-chip ${gpsState}`}><i />{gpsState === 'live' ? 'PHONE GPS LIVE' : gpsState === 'requesting' ? 'LOCATING…' : gpsState === 'demo' ? 'DEMO LOCATION' : 'GPS OFF'}</span><button className="tool-button active" onClick={() => notify('Map layers are visible')}><Layers3 size={16} /></button><button className="tool-button" onClick={locateMe} title="Locate me"><Crosshair size={16} /></button><button className="tool-button" onClick={() => notify('Use the +/- controls on the map to zoom')}><SlidersHorizontal size={16} /></button></div>
              </div>
              <div className="map-canvas">
                <RealCampusMap shuttles={liveShuttles} selectedId={selectedId} onSelect={(id) => { setSelectedId(id); setMapRequest({ type: 'shuttle', id: Date.now(), targetId: id }) }} userLocation={userLocation} mapRequest={mapRequest} routeDetails={mapRouteDetails} />
                <div className="map-overlay-legend"><span><i className="legend-line route-line" /> Shuttle route</span><span><i className="legend-dot you-dot" /> Your location</span><span><i className="legend-dot stop-dot" /> Pickup stop</span></div>
                <button className="locate-button" onClick={locateMe} title="Use my phone location"><LocateFixed size={17} /></button>
                <div className="gps-help"><span className={`gps-help-dot ${gpsState}`} /><strong>{gpsMessage}</strong>{gpsState === 'denied' && <button onClick={locateMe}>Try again</button>}</div>
              </div>
            </div>

            <aside className="detail-column">
              <div className="selected-card">
                <div className="selected-card-header"><div><span className="eyebrow small">SELECTED SHUTTLE</span><h2>{selected.id}</h2></div><button className="close-small" onClick={() => setSelectedId('BUS-001')}><MoreHorizontal size={19} /></button></div>
                <div className="route-name"><span className="route-badge"><Route size={15} /></span><span>{selected.route}</span><span className="status-pill"><i /> {selected.status}</span></div>
                <div className="detail-stats"><div><span>Next stop</span><strong>{selected.nextStop || 'TDK'}</strong></div><div><span>ETA</span><strong>{selected.eta}</strong></div></div>
                <div className="detail-stats"><div><span>Distance from you</span><strong>{formatDistance(selected.distanceKm)}</strong></div><div><span>Speed</span><strong>{selected.speed} <small>km/h</small></strong></div></div>
                <div className="gps-status"><div className="gps-icon"><Signal size={15} /></div><div><strong>Shuttle GPS connected</strong><span>Last update · 3 seconds ago</span></div><ShieldCheck size={16} className="verified-icon" /></div>
                <button className="track-button" onClick={trackSelected}>Track {selected.id}<Navigation size={16} /></button>
                <SeatBoarding shuttleId={selected.id} user={user} userLocation={userLocation} notify={notify} />
              </div>

              <div className="stops-card"><div className="card-heading"><div><h3>Route progress</h3><span>{selectedRouteDetails?.route.route_name || selected.route}</span></div><button className="text-button" onClick={viewFullRoute}>View route <Navigation size={14} /></button></div><div className="stop-list">{visibleStops.map((stop) => <div className={`stop-row ${stop.state}`} key={stop.name}><div className="stop-rail"><span className="stop-node" /><span className="rail-line" /></div><div className="stop-info"><strong>{stop.name}</strong><span>{stop.state === 'passed' ? 'Passed' : stop.state === 'current' ? 'Next pickup point' : 'Upcoming pickup point'}</span></div><strong className="stop-eta">{stop.eta}</strong></div>)}</div></div>
            </aside>
          </section>

          {selected.id && <TripMessaging shuttleId={selected.id} routeName={selected.route} routeStops={selectedRouteDetails?.stops || []} user={user} notify={notify} onViewMap={(latitude, longitude, label) => { setMapRequest({ type: 'message', id: Date.now(), targetLocation: [latitude, longitude], message: label }); notify('Centered on the trip update location') }} />}

          <section className="below-grid">
            <div className="nearby-card"><div className="card-heading"><div><h3>Nearby shuttles</h3><span>Sorted by distance from your phone</span></div><button className="text-button" onClick={locateMe}>Locate me <LocateFixed size={14} /></button></div><div className="nearby-list">{nearbyShuttles.map((shuttle) => <button key={shuttle.id} className={`nearby-row ${selectedId === shuttle.id ? 'selected' : ''}`} onClick={() => { setSelectedId(shuttle.id); setMapRequest({ type: 'shuttle', id: Date.now(), targetId: shuttle.id }) }}><span className="bus-mini" style={{ backgroundColor: shuttle.color }}><BusFront size={17} /></span><span className="nearby-name"><strong>{shuttle.id}</strong><small>{shuttle.route}</small></span><span className="nearby-meta"><strong>{shuttle.eta}</strong><small>{formatDistance(shuttle.distanceKm)}</small></span><span className={`mini-status ${shuttle.status === 'Arriving' ? 'arriving' : ''}`}><i />{shuttle.status}</span><ChevronDown size={16} className="row-chevron" /></button>)}</div></div>
            <div className="service-card"><div className="service-card-top"><div className="service-icon"><Sparkles size={18} /></div><div><span className="eyebrow small">SERVICE UPDATE</span><h3>Incoming TDK service overview</h3></div></div><p>Route and GPS status are loaded from the database. Drivers can broadcast their phone position from Driver GPS.</p><button className="text-button" onClick={() => notify('All service updates opened')}>See service updates <Navigation size={14} /></button></div>
          </section>
  </>
}

function formatDistance(distanceKm: number) {
  return distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`
}

function Metric({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: string; detail: string; tone: string }) {
  return <div className="metric-card"><div className={`metric-icon ${tone}`}>{icon}</div><div><span>{label}</span><strong>{value}</strong><small><i className={tone === 'yellow' ? 'yellow-dot' : ''} />{detail}</small></div></div>
}

function SimulatorPanel({ simState, simSpeed, setSimSpeed, vehicleId, routeName, start, pause, resume, stop, close }: { simState: string; simSpeed: number; setSimSpeed: (value: number) => void; vehicleId: string; routeName: string; start: () => void; pause: () => void; resume: () => void; stop: () => void; close: () => void }) {
  return <div className="simulator-panel"><div className="simulator-title"><div className="simulator-icon"><Gauge size={18} /></div><div><strong>GPS route simulator</strong><span>Test live movement without a driver device</span></div><span className={`sim-state ${simState}`}><i />{simState === 'idle' ? 'Ready' : simState === 'running' ? 'Running' : 'Paused'}</span><button className="close-small" onClick={close}><X size={17} /></button></div><div className="simulator-controls"><div className="sim-select"><span>Vehicle</span><strong><BusFront size={15} /> BUS-001</strong></div><div className="sim-select"><span>Route</span><strong><Route size={15} /> Big Shuttle Loop</strong></div><div className="speed-control"><span>Simulation speed</span><div className="speed-options">{[10, 20, 30, 40, 60].map((speed) => <button key={speed} className={simSpeed === speed ? 'active' : ''} onClick={() => setSimSpeed(speed)}>{speed}</button>)}<small>km/h</small></div></div><div className="sim-actions">{simState === 'idle' && <button className="primary-button compact" onClick={start}><Play size={14} /> Start</button>}{simState === 'running' && <button className="secondary-button compact" onClick={pause}><Pause size={14} /> Pause</button>}{simState === 'paused' && <button className="primary-button compact" onClick={resume}><Play size={14} /> Resume</button>}<button className="secondary-button compact danger" onClick={stop}><Square size={13} /> Stop</button></div></div></div>
}
