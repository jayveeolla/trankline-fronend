import { useEffect, useMemo, useState } from 'react'
import { BusFront, Crosshair, MapPin, Navigation, Plus, Minus } from 'lucide-react'
import type { MapRequest, MapShuttle, UserLocation } from './RealMap'

const seedCenter: [number, number] = [43.2609, -79.9192]
const routeSeed: [number, number][] = [[43.2635, -79.9202], [43.2627, -79.9194], [43.2615, -79.9186], [43.2605, -79.9197], [43.2598, -79.9214], [43.2587, -79.9233], [43.2577, -79.9248]]
const stopSeed = [
  { name: 'Lot I', location: [43.2635, -79.9202] as [number, number], eta: 'now' },
  { name: 'Academic Building', location: [43.2615, -79.9186] as [number, number], eta: '4 min' },
  { name: 'Main Gate', location: [43.2598, -79.9214] as [number, number], eta: '7 min' },
  { name: 'Student Centre', location: [43.2577, -79.9248] as [number, number], eta: '11 min' },
]

function localize(location: [number, number], userLocation: UserLocation | null): [number, number] {
  if (!userLocation || (Math.abs(userLocation.latitude - seedCenter[0]) <= 1 && Math.abs(userLocation.longitude - seedCenter[1]) <= 1)) return location
  return [location[0] + userLocation.latitude - seedCenter[0], location[1] + userLocation.longitude - seedCenter[1]]
}

function point(location: [number, number], center: [number, number]) {
  const x = 50 + ((location[1] - center[1]) / 0.014) * 44
  const y = 50 - ((location[0] - center[0]) / 0.010) * 44
  return { x: Math.max(4, Math.min(96, x)), y: Math.max(7, Math.min(93, y)) }
}

export default function VectorMap({ shuttles, selectedId, onSelect, userLocation, mapRequest }: { shuttles: MapShuttle[]; selectedId: string; onSelect: (id: string) => void; userLocation: UserLocation | null; mapRequest: MapRequest }) {
  const [zoom, setZoom] = useState(1)
  const [mapNotice, setMapNotice] = useState('')
  const center: [number, number] = userLocation ? [userLocation.latitude, userLocation.longitude] : seedCenter
  const renderedRoute = routeSeed.map((location) => point(localize(location, userLocation), center))
  const renderedStops = stopSeed.map((stop) => ({ ...stop, point: point(localize(stop.location, userLocation), center) }))
  const routePoints = renderedRoute.map(({ x, y }) => `${x},${y}`).join(' ')
  const renderedShuttles = useMemo(() => shuttles.map((shuttle) => ({ ...shuttle, point: point(shuttle.location, center) })), [center[0], center[1], shuttles])

  useEffect(() => {
    if (!mapRequest.id) return
    setMapNotice(mapRequest.type === 'user' ? 'Centered on your phone' : mapRequest.type === 'shuttle' ? `Following ${mapRequest.targetId || 'selected shuttle'}` : mapRequest.type === 'route' ? 'Showing the full route' : 'Showing all active shuttles')
    const timer = window.setTimeout(() => setMapNotice(''), 1800)
    return () => window.clearTimeout(timer)
  }, [mapRequest.id, mapRequest.targetId, mapRequest.type])

  return <div className="vector-map">
    <div className="vector-map-toolbar"><span><i /> LIVE GPS MAP</span><strong>{userLocation ? 'Your area' : 'Campus demo area'}</strong></div>
    <div className="vector-map-scene" style={{ transform: `scale(${zoom})` }}>
      <svg className="vector-map-art" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Live shuttle vector map">
        <defs><pattern id="city-grid" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M 8 0 L 0 0 0 8" fill="none" stroke="#d3dde0" strokeWidth=".22" /></pattern><linearGradient id="water-gradient" x1="0" x2="1"><stop stopColor="#a7dbe5" /><stop offset="1" stopColor="#7cc4d4" /></linearGradient></defs>
        <rect width="100" height="100" fill="#e8eef0" /><rect width="100" height="100" fill="url(#city-grid)" opacity=".9" />
        <path d="M-8 8 C12 18 22 9 32 18 S48 30 59 24 S78 11 108 22 L108 -5 L-8 -5Z" fill="#c6e3bd" />
        <path d="M76 -8 C65 14 71 29 81 39 S91 63 104 70 L104 -8Z" fill="url(#water-gradient)" opacity=".92" />
        <path d="M-4 74 C14 65 21 72 33 79 S58 85 67 103 L-4 103Z" fill="#c8e6bd" />
        <g fill="none" stroke="#ffffff" strokeLinecap="round"><path d="M-7 34 C18 30 30 38 47 36 S75 27 106 34" strokeWidth="4.2" /><path d="M-5 55 C18 49 35 54 54 61 S81 65 106 57" strokeWidth="3.7" /><path d="M21 -6 C26 16 20 31 26 48 S28 79 22 106" strokeWidth="3.5" /><path d="M58 -6 C55 12 61 30 55 47 S52 78 62 106" strokeWidth="3.7" /><path d="M87 -5 C77 13 83 29 90 43 S92 76 84 105" strokeWidth="3.7" /><path d="M-4 87 C22 81 38 90 54 88 S81 78 105 84" strokeWidth="3.2" /></g>
        <g fill="none" stroke="#c6d0d3" strokeWidth=".55"><path d="M-7 34 C18 30 30 38 47 36 S75 27 106 34" /><path d="M-5 55 C18 49 35 54 54 61 S81 65 106 57" /><path d="M21 -6 C26 16 20 31 26 48 S28 79 22 106" /><path d="M58 -6 C55 12 61 30 55 47 S52 78 62 106" /><path d="M87 -5 C77 13 83 29 90 43 S92 76 84 105" /></g>
        <polyline points={routePoints} fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" opacity=".9" /><polyline points={routePoints} fill="none" stroke="#237ef0" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
        <g fill="#657883" fontFamily="DM Sans, sans-serif" fontSize="2.3" fontWeight="700" letterSpacing=".35"><text x="8" y="28">WEST LOOP</text><text x="65" y="17">NORTH CAMPUS</text><text x="70" y="78">EAST CAMPUS</text><text x="35" y="96">MAIN STREET</text><text x="35" y="27">INNOVATION DRIVE</text></g>
        <g fill="#73858b" fontFamily="DM Sans, sans-serif" fontSize="1.8" fontWeight="600"><text x="9" y="46">Science Avenue</text><text x="67" y="47">East Main Ave</text><text x="5" y="70">Technology Road</text><text x="45" y="14">Royal Gardens</text></g>
      </svg>
      {renderedStops.map((stop, index) => <div className={`vector-stop ${index === 0 ? 'current' : ''}`} key={stop.name} style={{ left: `${stop.point.x}%`, top: `${stop.point.y}%` }}><span className="vector-stop-pin"><MapPin size={13} fill="currentColor" /></span><strong>{stop.name}</strong><small>{stop.eta}</small></div>)}
      <div className="vector-user" style={{ left: '50%', top: '57%' }}><span className="vector-user-pulse" /><span className="vector-user-dot" /><strong>YOU</strong></div>
      {renderedShuttles.map((shuttle) => <button className={`vector-shuttle ${selectedId === shuttle.id ? 'selected' : ''}`} key={shuttle.id} style={{ left: `${shuttle.point.x}%`, top: `${shuttle.point.y}%`, '--bus-color': shuttle.color } as React.CSSProperties} onClick={() => onSelect(shuttle.id)}><span className="vector-shuttle-pulse" /><span className="vector-bus-icon"><BusFront size={17} /></span><strong>{shuttle.id}</strong></button>)}
    </div>
    <div className="vector-controls"><button onClick={() => setZoom((value) => Math.min(1.35, value + .1))}><Plus size={16} /></button><button onClick={() => setZoom((value) => Math.max(.85, value - .1))}><Minus size={16} /></button><button onClick={() => { setZoom(1); setMapNotice('Map reset') }}><Crosshair size={15} /></button></div>
    <div className="vector-compass"><Navigation size={16} fill="currentColor" /><span>N</span></div>
    {mapNotice && <div className="vector-map-notice">{mapNotice}</div>}
  </div>
}
