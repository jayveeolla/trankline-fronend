import { useEffect } from 'react'
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'

export type BuilderStop = {
  pickupCode?: string
  pickupName: string
  address?: string
  latitude: number
  longitude: number
  sequence: number
  waitingTimeMinutes: number
}

export type BuilderLocation = { name: string; address?: string; latitude: number; longitude: number }

const philippinesCenter: [number, number] = [12.8797, 121.774]

function markerIcon(label: string, className: string) {
  return L.divIcon({ className: `route-builder-marker ${className}`, html: `<span>${label}</span>`, iconSize: [34, 34], iconAnchor: [17, 17] })
}

function MapResizeHandler() {
  const map = useMap()
  useEffect(() => {
    const refresh = () => map.invalidateSize({ pan: false, debounceMoveend: true })
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(refresh) : null
    observer?.observe(map.getContainer())
    window.addEventListener('resize', refresh)
    const timer = window.setTimeout(refresh, 100)
    return () => { observer?.disconnect(); window.removeEventListener('resize', refresh); window.clearTimeout(timer) }
  }, [map])
  return null
}

function MapClickHandler({ onMapClick }: { onMapClick: (latitude: number, longitude: number) => void }) {
  useMapEvents({ click: (event) => onMapClick(event.latlng.lat, event.latlng.lng) })
  return null
}

export default function RouteBuilderMap({ start, stops, destination, geometry, onMapClick, onStartDrag, onStopDrag }: { start: BuilderLocation | null; stops: BuilderStop[]; destination: BuilderLocation; geometry: Array<[number, number]>; onMapClick: (latitude: number, longitude: number) => void; onStartDrag: (latitude: number, longitude: number) => void; onStopDrag: (index: number, latitude: number, longitude: number) => void }) {
  const straightLine = [
    ...(start ? [[start.latitude, start.longitude] as [number, number]] : []),
    ...stops.slice().sort((a, b) => a.sequence - b.sequence).map((stop) => [stop.latitude, stop.longitude] as [number, number]),
    [destination.latitude, destination.longitude] as [number, number],
  ]
  const routeLine = geometry.length > 1 ? geometry : straightLine

  return <MapContainer className="route-builder-map" center={start ? [start.latitude, start.longitude] : philippinesCenter} zoom={start ? 13 : 6} minZoom={5} maxZoom={19} scrollWheelZoom style={{ width: '100%', height: '100%' }}>
    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" subdomains={['a', 'b', 'c']} />
    <MapClickHandler onMapClick={onMapClick} />
    <MapResizeHandler />
    {routeLine.length > 1 && <Polyline positions={routeLine} pathOptions={{ color: '#1677f2', weight: 6, opacity: 0.9 }} />}
    {start && <Marker position={[start.latitude, start.longitude]} icon={markerIcon('START', 'start')} draggable eventHandlers={{ dragend: (event) => { const position = event.target.getLatLng(); onStartDrag(position.lat, position.lng) } }} />}
    {stops.map((stop, index) => <Marker key={`${stop.pickupCode || stop.pickupName}-${index}`} position={[stop.latitude, stop.longitude]} icon={markerIcon(String(index + 1), 'stop')} draggable eventHandlers={{ dragend: (event) => { const position = event.target.getLatLng(); onStopDrag(index, position.lat, position.lng) } }} />)}
    <Marker position={[destination.latitude, destination.longitude]} icon={markerIcon('TDK', 'destination')} />
  </MapContainer>
}
