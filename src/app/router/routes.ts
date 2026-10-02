export type AppRouteKind =
  | 'live-tracking'
  | 'routes'
  | 'route-detail'
  | 'shuttles'
  | 'shuttle-detail'
  | 'shuttle-edit'
  | 'shuttle-seat-layout'
  | 'shuttle-history'
  | 'driver-gps'
  | 'gps-test-run'
  | 'stops'
  | 'stop-detail'
  | 'drivers'
  | 'driver-detail'
  | 'assignments'
  | 'schedules'
  | 'trip-history'
  | 'trip-detail'
  | 'alerts'
  | 'alert-detail'
  | 'users'
  | 'roles'
  | 'profile'
  | 'settings'
  | 'not-found'

export type AppRoute = {
  kind: AppRouteKind
  pathname: string
  params: Record<string, string>
  navLabel: string
}

const decode = (value: string) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const route = (kind: AppRouteKind, pathname: string, navLabel: string, params: Record<string, string> = {}): AppRoute => ({ kind, pathname, navLabel, params })

export function resolveAppRoute(pathname: string): AppRoute {
  const cleanPath = pathname.split('?')[0].replace(/\/+$/, '') || '/'
  const parts = cleanPath.split('/').filter(Boolean).map(decode)
  const [section, id, child] = parts

  if (cleanPath === '/' || cleanPath === '/live-tracking') return route('live-tracking', cleanPath, 'Live tracking')
  if (section === 'routes') return id ? route('route-detail', cleanPath, 'Routes', { routeId: id, mode: id === 'new' ? 'new' : child === 'edit' ? 'edit' : 'detail' }) : route('routes', cleanPath, 'Routes')
  if (section === 'shuttles') {
    if (!id) return route('shuttles', cleanPath, 'Shuttles')
    if (id === 'new' || id === 'add') return route('shuttles', cleanPath, 'Shuttles', { mode: 'new' })
    if (child === 'history') return route('shuttle-history', cleanPath, 'Shuttles', { shuttleId: id })
    if (child === 'seat-layout') return route('shuttle-seat-layout', cleanPath, 'Shuttles', { shuttleId: id })
    if (child === 'edit') return route('shuttle-edit', cleanPath, 'Shuttles', { shuttleId: id })
    return route('shuttle-detail', cleanPath, 'Shuttles', { shuttleId: id })
  }
  if (section === 'driver-gps') return route('driver-gps', cleanPath, 'Driver GPS')
  if (section === 'gps-test-run') return route('gps-test-run', cleanPath, 'GPS Test Run')
  if (section === 'stops') return route(id ? 'stop-detail' : 'stops', cleanPath, 'Stops', id ? { stopId: id, mode: child === 'edit' ? 'edit' : 'detail' } : {})
  if (section === 'drivers') return route(id ? 'driver-detail' : 'drivers', cleanPath, 'Drivers', id ? { driverId: id, mode: child === 'edit' ? 'edit' : 'detail' } : {})
  if (section === 'assignments') return route(id ? 'route-detail' : 'assignments', cleanPath, 'Assignments', id ? { assignmentId: id, mode: child === 'edit' ? 'edit' : 'detail' } : {})
  if (section === 'schedules') return route(id ? 'route-detail' : 'schedules', cleanPath, 'Schedules', id ? { scheduleId: id, mode: child === 'edit' ? 'edit' : 'detail' } : {})
  if (section === 'trip-history') return route(id ? 'trip-detail' : 'trip-history', cleanPath, 'Trip history', id ? { tripId: id } : {})
  if (section === 'alerts') return route(id ? 'alert-detail' : 'alerts', cleanPath, 'Alerts', id ? { alertId: id } : {})
  if (section === 'users') return route(id ? 'users' : 'users', cleanPath, 'Users & roles', id ? { userId: id, mode: child === 'edit' ? 'edit' : 'detail' } : {})
  if (section === 'roles') return route(id ? 'roles' : 'roles', cleanPath, 'Users & roles', id ? { roleId: id, mode: child === 'edit' ? 'edit' : 'detail' } : {})
  if (section === 'profile') return route('profile', cleanPath, 'Profile')
  if (section === 'settings') return route('settings', cleanPath, 'Settings')
  return route('not-found', cleanPath, 'Live tracking')
}

export const sidebarPaths: Record<string, string> = {
  'Live tracking': '/live-tracking',
  Routes: '/routes',
  Shuttles: '/shuttles',
  'Driver GPS': '/driver-gps',
  'GPS Test Run': '/gps-test-run',
  Stops: '/stops',
  Drivers: '/drivers',
  Assignments: '/assignments',
  Schedules: '/schedules',
  'Trip history': '/trip-history',
  Alerts: '/alerts',
  'Users & roles': '/users',
  Profile: '/profile',
  Settings: '/settings',
}
