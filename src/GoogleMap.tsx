import { useEffect, useRef, useState } from 'react'
import { Loader } from '@googlemaps/js-api-loader'
import type { MapRequest, MapShuttle, UserLocation } from './RealMap'

const seedCenter: [number, number] = [43.2609, -79.9192]
const routePath: [number, number][] = [
  [43.2635, -79.9202], [43.2627, -79.9194], [43.2615, -79.9186], [43.2605, -79.9197],
  [43.2598, -79.9214], [43.2587, -79.9233], [43.2577, -79.9248],
]
const routeStops = [
  { name: 'Lot I', location: [43.2635, -79.9202] as [number, number], eta: 'now' },
  { name: 'Academic Building', location: [43.2615, -79.9186] as [number, number], eta: '4 min' },
  { name: 'Main Gate', location: [43.2598, -79.9214] as [number, number], eta: '7 min' },
  { name: 'Student Centre', location: [43.2577, -79.9248] as [number, number], eta: '11 min' },
]

function localize(location: [number, number], userLocation: UserLocation | null): [number, number] {
  if (!userLocation || (Math.abs(userLocation.latitude - seedCenter[0]) <= 1 && Math.abs(userLocation.longitude - seedCenter[1]) <= 1)) return location
  return [location[0] + userLocation.latitude - seedCenter[0], location[1] + userLocation.longitude - seedCenter[1]]
}

export default function GoogleCampusMap({ apiKey, shuttles, selectedId, onSelect, userLocation, mapRequest }: { apiKey: string; shuttles: MapShuttle[]; selectedId: string; onSelect: (id: string) => void; userLocation: UserLocation | null; mapRequest: MapRequest }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const overlaysRef = useRef<Array<google.maps.Marker | google.maps.Polyline>>([])
  const [error, setError] = useState('')
  const mapCenter = userLocation ? { lat: userLocation.latitude, lng: userLocation.longitude } : { lat: seedCenter[0], lng: seedCenter[1] }

  useEffect(() => {
    if (!containerRef.current) return
    const loader = new Loader({ apiKey, version: 'weekly' })
    loader.load().then(() => {
      if (!containerRef.current) return
      mapRef.current = new google.maps.Map(containerRef.current, { center: mapCenter, zoom: 15, mapTypeControl: true, streetViewControl: false, fullscreenControl: true, styles: [{ elementType: 'geometry', stylers: [{ color: '#202c3b' }] }, { elementType: 'labels.text.fill', stylers: [{ color: '#c4d0df' }] }, { elementType: 'labels.text.stroke', stylers: [{ color: '#202c3b' }] }] })
    }).catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Google Maps could not load.'))
    return () => { mapRef.current = null }
  }, [apiKey])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    overlaysRef.current.forEach((overlay) => overlay.setMap(null))
    overlaysRef.current = []
    const path = routePath.map((point) => ({ lat: localize(point, userLocation)[0], lng: localize(point, userLocation)[1] }))
    const polyline = new google.maps.Polyline({ map, path, strokeColor: '#2f8cff', strokeOpacity: .95, strokeWeight: 6 })
    overlaysRef.current.push(polyline)
    routeStops.forEach((stop) => {
      const location = localize(stop.location, userLocation)
      const marker = new google.maps.Marker({ map, position: { lat: location[0], lng: location[1] }, title: stop.name, label: { text: '●', color: '#ffd071', fontSize: '22px' } })
      marker.addListener('click', () => new google.maps.InfoWindow({ content: `<strong>${stop.name}</strong><br/>Pickup stop · ETA ${stop.eta}` }).open({ map, anchor: marker }))
      overlaysRef.current.push(marker)
    })
    if (userLocation) {
      const marker = new google.maps.Marker({ map, position: { lat: userLocation.latitude, lng: userLocation.longitude }, title: 'Your phone location', label: 'YOU', icon: { path: google.maps.SymbolPath.CIRCLE, scale: 9, fillColor: '#328fff', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 3 } })
      overlaysRef.current.push(marker)
    }
    shuttles.forEach((shuttle) => {
      const marker = new google.maps.Marker({ map, position: { lat: shuttle.location[0], lng: shuttle.location[1] }, title: shuttle.id, label: { text: shuttle.id, color: '#ffffff', fontWeight: '700' }, icon: { path: google.maps.SymbolPath.CIRCLE, scale: selectedId === shuttle.id ? 12 : 9, fillColor: shuttle.color, fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 3 } })
      marker.addListener('click', () => onSelect(shuttle.id))
      overlaysRef.current.push(marker)
    })
  }, [shuttles, selectedId, userLocation, onSelect])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapRequest.id) return
    if (mapRequest.type === 'user' && userLocation) map.setCenter({ lat: userLocation.latitude, lng: userLocation.longitude })
    if (mapRequest.type === 'shuttle') {
      const target = shuttles.find((shuttle) => shuttle.id === mapRequest.targetId) ?? shuttles[0]
      if (target && userLocation) {
        const bounds = new google.maps.LatLngBounds()
        bounds.extend({ lat: userLocation.latitude, lng: userLocation.longitude })
        bounds.extend({ lat: target.location[0], lng: target.location[1] })
        map.fitBounds(bounds, 70)
      } else if (target) map.setCenter({ lat: target.location[0], lng: target.location[1] })
    }
  }, [mapRequest.id])

  return <div className="google-map-wrap"><div ref={containerRef} className="google-map-canvas" />{error && <div className="map-provider-error">Google Maps could not load. Check that the key is restricted to this localhost origin and that Maps JavaScript API is enabled.</div>}</div>
}
