import { useEffect } from 'react'
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { LatLngBoundsExpression, LatLngExpression } from 'leaflet'
import type { ApiRouteDetails } from './api'
import GoogleCampusMap from './GoogleMap'
import VectorMap from './VectorMap'

export type MapShuttle = {
  id: string
  route: string
  driver: string
  nextStop: string | null
  eta: string
  speed: number
  heading?: number
  color: string
  location: [number, number]
  status: 'On route' | 'Arriving' | 'Paused'
  distanceKm: number
}

export type UserLocation = { latitude: number; longitude: number; accuracy: number }
export type MapRequest = { type: 'user' | 'shuttle' | 'all' | 'route' | 'message'; id: number; targetId?: string; targetLocation?: [number, number]; message?: string }

const campusCenter: [number, number] = [14.2724796, 121.0632645]
function localizeToPhone(location: [number, number], _userLocation: UserLocation | null): [number, number] { return location }

const shuttleIcon = (color: string, selected: boolean, id: string, heading = 0) => L.divIcon({
  className: 'leaflet-shuttle-icon',
  iconSize: [84, 62],
  iconAnchor: [42, 29],
  html: `<div class="leaflet-shuttle-wrap ${selected ? 'selected' : ''}" style="--bus-color:${color}"><span class="leaflet-shuttle-pulse"></span><span class="leaflet-shuttle-bus">▣</span><strong>${id}</strong></div>`,
})

const userIcon = L.divIcon({
  className: 'leaflet-user-icon',
  iconSize: [44, 54],
  iconAnchor: [22, 27],
  html: '<div class="leaflet-user-wrap"><span class="leaflet-user-pulse"></span><span class="leaflet-user-dot"></span><strong>YOU</strong></div>',
})

const stopIcon = (sequence: number, name: string, state: 'next' | 'passed' | 'upcoming' = 'upcoming') => L.divIcon({
  className: `leaflet-stop-icon ${state}`,
  iconSize: [180, 70],
  iconAnchor: [90, 70],
  html: `<div class="leaflet-stop-wrap"><strong class="leaflet-stop-label">${state === 'next' ? 'NEXT · ' : ''}${sequence}. ${name}</strong><span><b>${sequence}</b></span></div>`,
})

const destinationIcon = L.divIcon({
  className: 'leaflet-destination-icon',
  iconSize: [58, 42],
  iconAnchor: [29, 35],
  html: '<div class="leaflet-destination-wrap"><span><img src="/favicon.ico" alt="" /></span><strong>TDK</strong></div>',
})
const messageIcon = L.divIcon({ className: 'leaflet-message-icon', iconSize: [28, 28], iconAnchor: [14, 14], html: '<span>!</span>' })

function routeCoordinates(routeDetails: ApiRouteDetails | null): [number, number][] {
  if (!routeDetails) return []
  if (routeDetails.route.route_geometry) {
    try {
      const parsed = typeof routeDetails.route.route_geometry === 'string' ? JSON.parse(routeDetails.route.route_geometry) : routeDetails.route.route_geometry
      if (Array.isArray(parsed) && parsed.length) return parsed as [number, number][]
    } catch { /* use stop coordinates when geometry is not valid JSON */ }
  }
  const route = routeDetails.route
  const start = route.start_latitude !== null && route.start_latitude !== undefined && route.start_longitude !== null && route.start_longitude !== undefined ? [[Number(route.start_latitude), Number(route.start_longitude)] as [number, number]] : []
  const stops = routeDetails.stops.filter((stop) => Number(stop.is_active) !== 0).sort((a, b) => a.sequence - b.sequence).map((stop) => [Number(stop.latitude), Number(stop.longitude)] as [number, number])
  const destination = route.destination_latitude !== null && route.destination_latitude !== undefined && route.destination_longitude !== null && route.destination_longitude !== undefined ? [[Number(route.destination_latitude), Number(route.destination_longitude)] as [number, number]] : []
  return [...start, ...stops, ...destination]
}

function MapController({ shuttles, userLocation, request, routeDetails }: { shuttles: MapShuttle[]; userLocation: UserLocation | null; request: MapRequest; routeDetails: ApiRouteDetails | null }) {
  const map = useMap()

  useEffect(() => {
    const refreshMap = () => {
      map.invalidateSize({ pan: false, debounceMoveend: true })
    }
    const container = map.getContainer()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(refreshMap) : null
    observer?.observe(container)
    window.addEventListener('resize', refreshMap)
    const refreshTimers = [0, 100, 300, 700].map((delay) => window.setTimeout(refreshMap, delay))
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', refreshMap)
      refreshTimers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [map])

  useEffect(() => {
    if (!request.id) return
    if (request.type === 'user' && userLocation) {
      map.setView([userLocation.latitude, userLocation.longitude], 16, { animate: true })
      return
    }
    if (request.type === 'shuttle') {
      const target = shuttles.find((shuttle) => shuttle.id === request.targetId) ?? shuttles[0]
      if (target && userLocation) {
        const bounds: LatLngBoundsExpression = [[userLocation.latitude, userLocation.longitude], target.location]
        map.fitBounds(bounds, { padding: [70, 70], maxZoom: 16, animate: true })
      } else if (target) {
        map.setView(target.location, 16, { animate: true })
      }
      return
    }
    if (request.type === 'route') {
      const route = routeCoordinates(routeDetails)
      if (route.length > 1) map.fitBounds(route as LatLngBoundsExpression, { padding: [45, 45], maxZoom: 16, animate: true })
      return
    }
    if (request.type === 'message' && request.targetLocation) {
      map.setView(request.targetLocation, 17, { animate: true })
      return
    }
    map.fitBounds(shuttles.map((shuttle) => shuttle.location), { padding: [35, 35], maxZoom: 16, animate: true })
  }, [map, request.id, request.targetId, request.type, request.targetLocation, routeDetails])

  return null
}

function LeafletCampusMap({ shuttles, selectedId, onSelect, userLocation, mapRequest, routeDetails }: { shuttles: MapShuttle[]; selectedId: string; onSelect: (id: string) => void; userLocation: UserLocation | null; mapRequest: MapRequest; routeDetails: ApiRouteDetails | null }) {
  const coordinates = routeCoordinates(routeDetails)
  const routeStart = coordinates[0]
  const mapCenter: LatLngExpression = userLocation ? [userLocation.latitude, userLocation.longitude] : routeStart || campusCenter
  const renderedRoute = coordinates.map((point) => localizeToPhone(point, userLocation))
  const renderedStops = (routeDetails?.stops || []).filter((stop) => Number(stop.is_active) !== 0).sort((a, b) => a.sequence - b.sequence).map((stop) => ({ ...stop, name: stop.pickup_name, location: localizeToPhone([Number(stop.latitude), Number(stop.longitude)], userLocation), eta: stop.estimated_arrival_offset ? `${stop.estimated_arrival_offset} min` : 'upcoming' }))
  const selectedShuttle = shuttles.find((shuttle) => shuttle.id === selectedId)
  const nextStop = selectedShuttle?.nextStop ? renderedStops.find((stop) => stop.name === selectedShuttle.nextStop) : null
  const nextStopIndex = nextStop ? renderedStops.findIndex((stop) => stop.stop_id === nextStop.stop_id) : selectedShuttle?.nextStop === null ? renderedStops.length : 0
  const renderedDestination = routeDetails?.route.destination_latitude !== null && routeDetails?.route.destination_latitude !== undefined && routeDetails?.route.destination_longitude !== null && routeDetails?.route.destination_longitude !== undefined ? localizeToPhone([Number(routeDetails.route.destination_latitude), Number(routeDetails.route.destination_longitude)], userLocation) : null
  const renderedShuttles = shuttles

  return <MapContainer className="real-leaflet-map" center={mapCenter} zoom={15} minZoom={3} maxZoom={19} scrollWheelZoom zoomControl attributionControl style={{ width: '100%', height: '100%' }}>
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>'
      url={import.meta.env.VITE_MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
      subdomains={['a', 'b', 'c']}
      updateWhenZooming
      updateWhenIdle
      maxNativeZoom={19}
      keepBuffer={2}
    />
    <Polyline positions={renderedRoute} pathOptions={{ color: '#237ef0', weight: 7, opacity: .95 }} />
    <Polyline positions={renderedRoute} pathOptions={{ color: '#84c7ff', weight: 2, opacity: .8, dashArray: '7 10' }} />
    {renderedStops.map((stop, index) => { const state = index === nextStopIndex ? 'next' : index < nextStopIndex ? 'passed' : 'upcoming'; return <Marker key={`${routeDetails?.route.id || 'route'}-${stop.stop_id}-${stop.sequence}-${stop.pickup_code || stop.name}`} position={stop.location} icon={stopIcon(stop.sequence, stop.name, state)}><Popup><strong>{stop.name}</strong><br />Pickup stop · ETA {stop.eta}</Popup></Marker> })}
    {renderedDestination && <Marker position={renderedDestination} icon={destinationIcon}><Popup><strong>{routeDetails?.route.destination_name || 'TDK'}</strong><br />Final destination</Popup></Marker>}
    {mapRequest.type === 'message' && mapRequest.targetLocation && <Marker position={mapRequest.targetLocation} icon={messageIcon}><Popup>{mapRequest.message || 'Trip update location'}</Popup></Marker>}
    {userLocation && <><Circle center={[userLocation.latitude, userLocation.longitude]} radius={Math.max(userLocation.accuracy, 12)} pathOptions={{ color: '#3294ff', fillColor: '#3294ff', fillOpacity: .12, weight: 1 }} /><Marker position={[userLocation.latitude, userLocation.longitude]} icon={userIcon}><Popup><strong>Your phone location</strong><br />Accuracy ±{userLocation.accuracy} m</Popup></Marker></>}
    {renderedShuttles.map((shuttle) => <Marker key={shuttle.id} position={shuttle.location} icon={shuttleIcon(shuttle.color, selectedId === shuttle.id, shuttle.id)} eventHandlers={{ click: () => onSelect(shuttle.id) }}><Popup><strong>{shuttle.id}</strong><br />{shuttle.route}<br />{shuttle.speed} km/h · {shuttle.distanceKm.toFixed(1)} km away</Popup></Marker>)}
    <MapController shuttles={renderedShuttles} userLocation={userLocation} request={mapRequest} routeDetails={routeDetails} />
  </MapContainer>
}

export default function RealCampusMap(props: { shuttles: MapShuttle[]; selectedId: string; onSelect: (id: string) => void; userLocation: UserLocation | null; mapRequest: MapRequest; routeDetails: ApiRouteDetails | null }) {
  const googleApiKey = import.meta.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  const provider = import.meta.env.VITE_MAP_PROVIDER || 'vector'
  if (provider === 'vector') return <VectorMap {...props} />
  return provider === 'google' && googleApiKey ? <GoogleCampusMap {...props} apiKey={googleApiKey} /> : <LeafletCampusMap {...props} />
}
