export type Coordinate = [number, number]

export function parseRouteGeometry(value: unknown): Coordinate[] {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    if (!Array.isArray(parsed)) return []
    return parsed.map((point) => [Number(point?.[0]), Number(point?.[1])] as Coordinate).filter(([latitude, longitude]) => Number.isFinite(latitude) && Number.isFinite(longitude))
  } catch {
    return []
  }
}

function distanceMeters(latitudeA: number, longitudeA: number, latitudeB: number, longitudeB: number) {
  const radius = 6371000
  const latitudeDelta = (latitudeB - latitudeA) * Math.PI / 180
  const longitudeDelta = (longitudeB - longitudeA) * Math.PI / 180
  const a = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(latitudeA * Math.PI / 180) * Math.cos(latitudeB * Math.PI / 180) * Math.sin(longitudeDelta / 2) ** 2
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function distanceToRouteMeters(point: Coordinate, route: Coordinate[]) {
  if (route.length < 2) return Number.POSITIVE_INFINITY
  let closest = Number.POSITIVE_INFINITY
  for (let index = 1; index < route.length; index += 1) {
    const start = route[index - 1]
    const end = route[index]
    const latitudeScale = 111320
    const longitudeScale = 111320 * Math.cos(((start[0] + end[0]) / 2) * Math.PI / 180)
    const startX = start[1] * longitudeScale
    const startY = start[0] * latitudeScale
    const endX = end[1] * longitudeScale
    const endY = end[0] * latitudeScale
    const pointX = point[1] * longitudeScale
    const pointY = point[0] * latitudeScale
    const dx = endX - startX
    const dy = endY - startY
    const ratio = Math.max(0, Math.min(1, (dx * (pointX - startX) + dy * (pointY - startY)) / ((dx * dx) + (dy * dy) || 1)))
    const projected: Coordinate = [start[0] + (end[0] - start[0]) * ratio, start[1] + (end[1] - start[1]) * ratio]
    closest = Math.min(closest, distanceMeters(point[0], point[1], projected[0], projected[1]))
  }
  return closest
}

export function routeWaypoints(current: Coordinate, stops: Array<{ pickup_name: string; latitude: number; longitude: number; sequence: number }>, destination: Coordinate, nextStop?: string | null) {
  const ordered = stops.slice().sort((a, b) => a.sequence - b.sequence)
  const nextIndex = nextStop ? Math.max(0, ordered.findIndex((stop) => stop.pickup_name === nextStop)) : ordered.length
  return [current, ...ordered.slice(nextIndex).map((stop) => [Number(stop.latitude), Number(stop.longitude)] as Coordinate), destination]
}
