import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  Bell,
  BusFront,
  ChevronDown,
  CircleHelp,
  CircleUserRound,
  Clock3,
  LogOut,
  MapPin,
  MapPinned,
  Menu,
  MoreHorizontal,
  Navigation,
  Radio,
  Route,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Moon,
  Users,
  X,
} from 'lucide-react'
import { getRealtimeSocket } from '../../realtime'
import { distanceToRouteMeters, parseRouteGeometry, routeWaypoints } from '../../routeUtils'
import { api, type ApiRoute, type ApiRouteDetails, type ApiStop, type ApiShuttle, type SessionUser } from '../../api'
import { matchAppRoute } from '../router/AppRouter'
import { sidebarPaths } from '../router/routes'
import WorkspacePage from '../router/WorkspacePage'
import LiveTrackingPage from '../../pages/live-tracking/LiveTrackingPage'

type Shuttle = {
  id: string
  route: string
  driver: string
  busNumber?: string
  plateNumber?: string | null
  vehicleType?: string | null
  capacity?: number
  gpsDeviceId?: string | null
  nextStop: string | null
  eta: string
  distance: string
  location: [number, number]
  routeId?: number | null
  speed: number
  heading?: number
  color: string
  x?: number
  y?: number
  status: 'On route' | 'Arriving' | 'Paused'
}

const campusCenter: [number, number] = [14.2724796, 121.0632645]
const initialShuttles: Shuttle[] = []

type UserLocation = { latitude: number; longitude: number; accuracy: number }
type GpsState = 'requesting' | 'live' | 'denied' | 'unavailable' | 'demo'
type MapRequest = { type: 'user' | 'shuttle' | 'all' | 'route' | 'message'; id: number; targetId?: string; targetLocation?: [number, number]; message?: string }

type AppRole = 'ADMIN' | 'DRIVER' | 'USER'

function appRole(role: string): AppRole {
  return role === 'ADMIN' ? 'ADMIN' : role === 'DRIVER' ? 'DRIVER' : 'USER'
}

const navItems = [
  { label: 'Live tracking', icon: MapPinned },
  { label: 'Routes', icon: Route },
  { label: 'Shuttles', icon: BusFront },
  { label: 'Driver GPS', icon: Radio },
  { label: 'Stops', icon: MapPin },
  { label: 'Drivers', icon: Users },
  { label: 'Assignments', icon: SlidersHorizontal },
  { label: 'Schedules', icon: Clock3 },
]

function haversineKm(latitudeA: number, longitudeA: number, latitudeB: number, longitudeB: number) {
  const earthRadiusKm = 6371
  const latitudeDelta = (latitudeB - latitudeA) * Math.PI / 180
  const longitudeDelta = (longitudeB - longitudeA) * Math.PI / 180
  const a = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(latitudeA * Math.PI / 180) * Math.cos(latitudeB * Math.PI / 180) * Math.sin(longitudeDelta / 2) ** 2
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}


function mapLiveShuttleRows(rows: ApiShuttle[]): Shuttle[] {
  const colors = ['#2f8cff', '#a8d85b', '#ffbd69']
  const uniqueRows = Array.from(new Map(rows.filter((shuttle) => shuttle.status === 'LIVE').map((shuttle) => { const id = String(shuttle.id).trim().toUpperCase(); return [id, { ...shuttle, id }] as const })).values())
  return uniqueRows.map((shuttle, index) => ({
    id: shuttle.id,
    route: shuttle.route || 'Unassigned route',
    driver: shuttle.driver || 'Driver not assigned',
    busNumber: shuttle.bus_number || shuttle.id,
    plateNumber: shuttle.plate_number,
    vehicleType: shuttle.vehicle_type || shuttle.vehicle_name,
    capacity: Number(shuttle.capacity) || 40,
    gpsDeviceId: shuttle.gps_device_id,
    nextStop: shuttle.next_stop || null,
    eta: 'Live',
    distance: '—',
    speed: Number(shuttle.speed) || 0,
    heading: Number((shuttle as ApiShuttle & { heading?: number }).heading) || 0,
    color: colors[index % colors.length],
    location: shuttle.latitude !== null && shuttle.longitude !== null ? [Number(shuttle.latitude), Number(shuttle.longitude)] : campusCenter,
    routeId: shuttle.route_id,
    status: shuttle.gps_state === 'PAUSED' ? 'Paused' : 'On route',
  }))
}

export default function Dashboard({ user, onLogout, onProfileUpdated }: { user: SessionUser; onLogout: () => void; onProfileUpdated: (user: SessionUser, token: string) => void }) {
  const [shuttles, setShuttles] = useState(initialShuttles)
  const [selectedId, setSelectedId] = useState('BUS-001')
  const [pathname, setPathname] = useState(() => window.location.pathname || '/live-tracking')
  const [simState, setSimState] = useState<'idle' | 'running' | 'paused'>('idle')
  const [simSpeed, setSimSpeed] = useState(30)
  const [showSimulator, setShowSimulator] = useState(false)
  const [toast, setToast] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => window.localStorage.getItem('trackline-theme') === 'light' ? 'light' : 'dark')
  const [routesFromDb, setRoutesFromDb] = useState<ApiRoute[]>([])
  const [apiShuttles, setApiShuttles] = useState<ApiShuttle[]>([])
  const [stopsFromDb, setStopsFromDb] = useState<ApiStop[]>([])
  const [settingsFromDb, setSettingsFromDb] = useState<Record<string, string>>({})
  const [systemSettingsFromDb, setSystemSettingsFromDb] = useState<Record<string, string>>({})
  const [selectedRouteDetails, setSelectedRouteDetails] = useState<ApiRouteDetails | null>(null)
  const [liveRouteGeometry, setLiveRouteGeometry] = useState<Array<[number, number]> | null>(null)
  const [databaseError, setDatabaseError] = useState('')
  const [dataVersion, setDataVersion] = useState(0)
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null)
  const [gpsState, setGpsState] = useState<GpsState>('requesting')
  const [gpsMessage, setGpsMessage] = useState('Requesting phone location…')
  const [mapRequest, setMapRequest] = useState<MapRequest>({ type: 'all', id: 0 })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false)
  const [sidebarAccountMenuOpen, setSidebarAccountMenuOpen] = useState(false)
  const [topAccountMenuOpen, setTopAccountMenuOpen] = useState(false)
  const [unreadAlerts, setUnreadAlerts] = useState(0)
  const role = appRole(user.role)
  const simulationIndex = useRef(0)
  const centeredOnUser = useRef(false)
  const rerouteSignature = useRef('')
  const currentRoute = matchAppRoute(pathname)
  const activeNav = currentRoute.navLabel
  const historyShuttleId = currentRoute.kind === 'shuttle-history' ? currentRoute.params.shuttleId || null : null

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname || '/live-tracking')
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = useCallback((nextPath: string) => {
    if (window.location.pathname !== nextPath) window.history.pushState({}, '', nextPath)
    setPathname(nextPath)
    setSidebarOpen(false)
    setSidebarAccountMenuOpen(false)
    setTopAccountMenuOpen(false)
  }, [])

  useEffect(() => {
    const publicForEveryRole = new Set(['Live tracking', 'Alerts', 'Profile'])
    const driverPages = new Set(['Driver GPS', 'Schedules', 'Trip history'])
    const allowed = role === 'ADMIN' || publicForEveryRole.has(currentRoute.navLabel) || (role === 'DRIVER' && driverPages.has(currentRoute.navLabel))
    if (!allowed) navigate('/live-tracking')
  }, [currentRoute.navLabel, navigate, role])

  useEffect(() => {
    const identity = currentRoute.params.shuttleId || currentRoute.params.tripId || currentRoute.params.routeId || currentRoute.params.alertId
    document.title = identity ? `${identity} | ${currentRoute.navLabel} | Trackline` : `${currentRoute.navLabel} | Trackline`
  }, [currentRoute])

  useEffect(() => {
    api.unreadAlertCount().then((result) => setUnreadAlerts(result.count)).catch(() => setUnreadAlerts(0))
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([api.routes(), api.stops(), api.shuttles(), api.settings()]).then(([routeResult, stopResult, shuttleResult, settingsResult]) => {
      if (!active) return
      setRoutesFromDb(routeResult.routes)
      setApiShuttles(shuttleResult.shuttles)
      setStopsFromDb(stopResult.stops)
      setSettingsFromDb(settingsResult.settings)
      const liveRows = shuttleResult.shuttles.filter((shuttle) => shuttle.status === 'LIVE')
      if (liveRows.length) {
        setSelectedId((current) => liveRows.some((shuttle) => shuttle.id === current) ? current : liveRows[0]?.id || '')
        setShuttles(mapLiveShuttleRows(liveRows))
      } else {
        setShuttles([])
        setSelectedId('')
      }
    }).catch((error) => {
      if (active) setDatabaseError(error instanceof Error ? error.message : 'Database data unavailable')
    })
    return () => { active = false }
  }, [dataVersion])

  useEffect(() => {
    if (role !== 'ADMIN') return
    let active = true
    api.systemSettings().then((result) => { if (active) setSystemSettingsFromDb(result.settings) }).catch(() => { if (active) setSystemSettingsFromDb({}) })
    return () => { active = false }
  }, [dataVersion, role])

  useEffect(() => {
    const socket = getRealtimeSocket()
    const refreshAlertCount = async () => { try { const result = await api.unreadAlertCount(); setUnreadAlerts(result.count) } catch { /* keep the last known badge */ } }
    const refreshLiveFleet = async (preferredId?: string) => {
      try {
        const result = await api.shuttles()
        setApiShuttles(result.shuttles)
        const liveRows = result.shuttles.filter((shuttle) => shuttle.status === 'LIVE')
        setShuttles(mapLiveShuttleRows(liveRows))
        if (preferredId && liveRows.some((shuttle) => shuttle.id === preferredId)) setSelectedId(preferredId)
        else if (!liveRows.length) setSelectedId('')
      } catch { /* the next GPS update or refresh will retry the fleet sync */ }
    }
    const updateTripStatus = (payload: { shuttle_id?: string; shuttleId?: string }, status: Shuttle['status']) => {
      const shuttleId = payload.shuttle_id || payload.shuttleId
      if (shuttleId) setShuttles((current) => current.map((shuttle) => shuttle.id === shuttleId ? { ...shuttle, status } : shuttle))
    }
    socket.on('shuttle:location', (payload: { shuttleId: string; latitude: number; longitude: number; speed: number; heading?: number; nextStop?: string | null; status?: string }) => {
      if (payload.status === 'COMPLETED' || payload.status === 'CANCELLED') {
        setShuttles((current) => current.filter((shuttle) => shuttle.id !== payload.shuttleId))
        return
      }
      setShuttles((current) => current.map((shuttle) => shuttle.id === payload.shuttleId ? { ...shuttle, location: [Number(payload.latitude), Number(payload.longitude)], speed: Number(payload.speed) || 0, heading: Number(payload.heading) || 0, nextStop: payload.nextStop ?? null, status: payload.status === 'AT_PICKUP_POINT' ? 'Arriving' : 'On route' } : shuttle))
    })
    socket.on('trip:started', (payload: { shuttle_id?: string; shuttleId?: string }) => {
      const shuttleId = String(payload.shuttle_id || payload.shuttleId || '').trim().toUpperCase()
      if (shuttleId) setShuttles((current) => current.filter((shuttle) => shuttle.id !== shuttleId))
      void refreshLiveFleet(shuttleId)
    })
    socket.on('trip:paused', (payload: { shuttle_id?: string; shuttleId?: string }) => updateTripStatus(payload, 'Paused'))
    socket.on('trip:resumed', (payload: { shuttle_id?: string; shuttleId?: string }) => updateTripStatus(payload, 'On route'))
    socket.on('trip:ended', (payload: { shuttle_id?: string; shuttleId?: string }) => { const shuttleId = payload.shuttle_id || payload.shuttleId; if (shuttleId) setShuttles((current) => current.filter((shuttle) => shuttle.id !== shuttleId)) })
    socket.on('trip:completed', (payload: { shuttle_id?: string; shuttleId?: string }) => { const shuttleId = payload.shuttle_id || payload.shuttleId; if (shuttleId) setShuttles((current) => current.filter((shuttle) => shuttle.id !== shuttleId)) })
    socket.on('trip_alert_created', refreshAlertCount)
    socket.on('trip_alert_resolved', refreshAlertCount)
    socket.on('alert_unread_count_updated', refreshAlertCount)
    return () => { /* shared realtime connection remains available to trip messaging */ }
  }, [])

  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsState('unavailable')
      setGpsMessage('This browser does not support phone GPS')
      return
    }

    setGpsState('requesting')
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Math.round(position.coords.accuracy),
        })
        setGpsState('live')
        setGpsMessage(`Phone GPS live · ±${Math.round(position.coords.accuracy)} m accuracy`)
        if (!centeredOnUser.current) {
          centeredOnUser.current = true
          setMapRequest({ type: 'user', id: Date.now() })
        }
      },
      (error) => {
        setGpsState(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable')
        setGpsMessage(error.code === error.PERMISSION_DENIED ? 'Location permission denied' : 'Location unavailable — using campus demo view')
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  const effectiveLocation = userLocation ?? { latitude: campusCenter[0], longitude: campusCenter[1], accuracy: 0 }
  const liveShuttles = useMemo(() => shuttles.map((shuttle) => ({
    ...shuttle,
    distanceKm: haversineKm(effectiveLocation.latitude, effectiveLocation.longitude, shuttle.location[0], shuttle.location[1]),
  })), [effectiveLocation.latitude, effectiveLocation.longitude, shuttles])
  const selected = liveShuttles.find((shuttle) => shuttle.id === selectedId) ?? liveShuttles[0] ?? { id: '—', route: 'No active incoming shuttle', driver: '—', nextStop: '—', eta: '—', distance: '—', location: campusCenter, routeId: null, speed: 0, color: '#2f8cff', status: 'Paused' as const, distanceKm: 0 }
  const nearbyShuttles = [...liveShuttles].sort((a, b) => a.distanceKm - b.distanceKm)

  useEffect(() => {
    if (!selected?.routeId) {
      setSelectedRouteDetails(null)
      setLiveRouteGeometry(null)
      rerouteSignature.current = ''
      return
    }
    setSelectedRouteDetails(null)
    setLiveRouteGeometry(null)
    rerouteSignature.current = ''
    let active = true
    api.route(selected.routeId).then(async (result) => {
      if (!result.route.route_geometry) {
        const points: Array<[number, number]> = [
          ...(result.route.start_latitude !== null && result.route.start_latitude !== undefined && result.route.start_longitude !== null && result.route.start_longitude !== undefined ? [[Number(result.route.start_latitude), Number(result.route.start_longitude)] as [number, number]] : []),
          ...result.stops.filter((stop) => Number(stop.is_active) !== 0).sort((a, b) => a.sequence - b.sequence).map((stop) => [Number(stop.latitude), Number(stop.longitude)] as [number, number]),
          ...(result.route.destination_latitude !== null && result.route.destination_latitude !== undefined && result.route.destination_longitude !== null && result.route.destination_longitude !== undefined ? [[Number(result.route.destination_latitude), Number(result.route.destination_longitude)] as [number, number]] : []),
        ]
        if (points.length >= 2) {
          try { const road = await api.routeGeometry(points); result.route.route_geometry = JSON.stringify(road.geometry); result.route.total_distance = road.distanceMeters; result.route.estimated_duration = Math.round(road.durationSeconds / 60) } catch { /* keep the saved database route when the routing service is unavailable */ }
        }
      }
      if (active) setSelectedRouteDetails(result)
    }).catch(() => { if (active) setSelectedRouteDetails(null) })
    return () => { active = false }
  }, [selected?.routeId, dataVersion])

  useEffect(() => {
    if (!selectedRouteDetails || !selected.id || selected.id === '—') return
    const savedGeometry = parseRouteGeometry(selectedRouteDetails.route.route_geometry)
    if (savedGeometry.length < 2) return
    const currentLocation: [number, number] = [Number(selected.location[0]), Number(selected.location[1])]
    if (distanceToRouteMeters(currentLocation, savedGeometry) <= 120) return
    const stops = selectedRouteDetails.stops.filter((stop) => Number(stop.is_active) !== 0).map((stop) => ({ pickup_name: stop.pickup_name, latitude: Number(stop.latitude), longitude: Number(stop.longitude), sequence: stop.sequence }))
    const destination: [number, number] = [Number(selectedRouteDetails.route.destination_latitude), Number(selectedRouteDetails.route.destination_longitude)]
    if (!Number.isFinite(destination[0]) || !Number.isFinite(destination[1])) return
    const signature = `${selectedRouteDetails.route.id}:${selected.nextStop || stops[0]?.pickup_name || 'route'}`
    if (rerouteSignature.current === signature) return
    rerouteSignature.current = signature
    let active = true
    api.routeGeometry(routeWaypoints(currentLocation, stops, destination, selected.nextStop)).then((result) => {
      if (active) setLiveRouteGeometry(result.geometry)
    }).catch(() => { if (active) rerouteSignature.current = '' })
    return () => { active = false }
  }, [selected.id, selected.location[0], selected.location[1], selected.nextStop, selectedRouteDetails])

  const mapRouteDetails = useMemo(() => {
    if (!selectedRouteDetails || !liveRouteGeometry) return selectedRouteDetails
    return { ...selectedRouteDetails, route: { ...selectedRouteDetails.route, route_geometry: JSON.stringify(liveRouteGeometry) } }
  }, [liveRouteGeometry, selectedRouteDetails])

  const visibleStops = useMemo(() => {
    if (!selectedRouteDetails) return []
    const source = selectedRouteDetails.stops.filter((stop) => Number(stop.is_active) !== 0).slice().sort((a, b) => a.sequence - b.sequence)
    if (!source.length) return []
    const serverNextIndex = selected.nextStop ? source.findIndex((stop) => stop.pickup_name === selected.nextStop) : source.length
    let nextIndex = serverNextIndex
    if (nextIndex < 0) {
      let nearestDistance = Number.POSITIVE_INFINITY
      source.forEach((stop, index) => { const distance = haversineKm(selected.location[0], selected.location[1], Number(stop.latitude), Number(stop.longitude)); if (distance < nearestDistance) { nearestDistance = distance; nextIndex = index } })
    }
    return source.map((stop, index) => ({ name: stop.pickup_name, eta: index === nextIndex ? 'next' : stop.estimated_arrival_offset ? `${stop.estimated_arrival_offset} min` : 'upcoming', state: index < nextIndex ? 'passed' : index === nextIndex ? 'current' : 'upcoming' }))
  }, [selected.location, selectedRouteDetails])
  const simulationRoute = useMemo<[number, number][]>(() => {
    if (!selectedRouteDetails) return []
    const route = selectedRouteDetails.route
    const start = route.start_latitude !== null && route.start_latitude !== undefined && route.start_longitude !== null && route.start_longitude !== undefined ? [[Number(route.start_latitude), Number(route.start_longitude)] as [number, number]] : []
    const routeStops = selectedRouteDetails.stops.filter((stop) => Number(stop.is_active) !== 0).slice().sort((a, b) => a.sequence - b.sequence).map((stop) => [Number(stop.latitude), Number(stop.longitude)] as [number, number])
    const destination = route.destination_latitude !== null && route.destination_latitude !== undefined && route.destination_longitude !== null && route.destination_longitude !== undefined ? [[Number(route.destination_latitude), Number(route.destination_longitude)] as [number, number]] : []
    return [...start, ...routeStops, ...destination]
  }, [selectedRouteDetails])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    if (simState !== 'running' || simulationRoute.length < 2) return
    const timer = window.setInterval(() => {
      setShuttles((current) => current.map((shuttle, index) => {
        if (index !== 0) return shuttle
        simulationIndex.current = (simulationIndex.current + 1) % simulationRoute.length
        const nextLocation = simulationRoute[simulationIndex.current]
        const isArriving = simulationIndex.current >= simulationRoute.length - 2
        return {
          ...shuttle,
          location: nextLocation,
          speed: simSpeed,
          status: isArriving ? 'Arriving' : 'On route',
        }
      }))
    }, 1100)
    return () => window.clearInterval(timer)
  }, [simState, simSpeed, simulationRoute])

  const routeStats = useMemo(() => ({
    live: shuttles.filter((shuttle) => shuttle.status !== 'Paused').length,
    minutes: selected.speed > 0 && selected.distanceKm > 0 ? String(Math.max(1, Math.round((selected.distanceKm / selected.speed) * 60))) : selectedRouteDetails?.route.estimated_duration ? String(selectedRouteDetails.route.estimated_duration) : '—',
  }), [selected.distanceKm, selected.speed, selectedRouteDetails, shuttles])

  const notify = useCallback((message: string) => setToast(message), [])

  const shareLiveView = async () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?view=live`
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(shareUrl)
      else {
        const input = document.createElement('textarea')
        input.value = shareUrl
        input.setAttribute('readonly', '')
        input.style.position = 'fixed'
        input.style.opacity = '0'
        document.body.appendChild(input)
        input.select()
        document.execCommand('copy')
        input.remove()
      }
      notify('Live view link copied to clipboard')
    } catch {
      notify(`Copy failed. Live view: ${shareUrl}`)
    }
  }

  useEffect(() => {
    window.localStorage.setItem('trackline-theme', theme)
  }, [theme])

  const startSimulation = () => {
    if (!simulationRoute.length) {
      notify('Select a database route before starting the GPS simulator')
      return
    }
    simulationIndex.current = 0
    setSimState('running')
    notify('GPS simulation started — BUS-001 is moving live')
  }

  const stopSimulation = () => {
    setSimState('idle')
    setDataVersion((value) => value + 1)
    simulationIndex.current = 0
    notify('Simulation stopped and route reset')
  }

  const locateMe = () => {
    if (gpsState === 'denied' || gpsState === 'unavailable') {
      notify('Please allow Location in your phone/browser settings, then tap locate again')
      return
    }
    if (!userLocation) {
      notify('Waiting for your phone GPS signal…')
      return
    }
    setMapRequest({ type: 'user', id: Date.now() })
    setIsFocused(true)
  }

  const trackSelected = () => {
    setMapRequest({ type: 'shuttle', id: Date.now(), targetId: selected.id })
    setIsFocused(true)
    notify(`Showing ${selected.id} and your location on the map`)
  }

  const viewFullRoute = () => {
    if (!selectedRouteDetails) {
      notify('Route details are still loading')
      return
    }
    setMapRequest({ type: 'route', id: Date.now() })
    notify('Showing the full route on the map')
  }

  const workspaceItems = [
    { label: 'Live tracking', icon: MapPinned, roles: ['ADMIN', 'DRIVER', 'USER'] as AppRole[] },
    { label: 'Routes', icon: Route, roles: ['ADMIN'] as AppRole[] },
    { label: 'Shuttles', icon: BusFront, roles: ['ADMIN'] as AppRole[] },
    { label: 'Driver GPS', icon: Radio, roles: ['ADMIN', 'DRIVER'] as AppRole[] },
    { label: 'GPS Test Run', icon: Activity, roles: ['ADMIN'] as AppRole[] },
    { label: 'Stops', icon: MapPin, roles: ['ADMIN'] as AppRole[] },
    { label: 'Drivers', icon: Users, roles: ['ADMIN'] as AppRole[] },
    { label: 'Assignments', icon: SlidersHorizontal, roles: ['ADMIN'] as AppRole[] },
    { label: 'Schedules', icon: Clock3, roles: ['ADMIN', 'DRIVER'] as AppRole[] },
  ].filter((item) => item.roles.includes(role))
  const manageItems = [
    { label: 'Trip history', icon: Clock3, roles: ['ADMIN', 'DRIVER'] as AppRole[] },
    { label: 'Alerts', icon: Bell, roles: ['ADMIN', 'DRIVER', 'USER'] as AppRole[] },
    { label: 'Users & roles', icon: ShieldCheck, roles: ['ADMIN'] as AppRole[] },
    { label: 'Profile', icon: CircleUserRound, roles: ['ADMIN', 'DRIVER', 'USER'] as AppRole[] },
    { label: 'Settings', icon: Settings, roles: ['ADMIN'] as AppRole[] },
  ].filter((item) => item.roles.includes(role))
  const selectNav = (label: string) => navigate(sidebarPaths[label] || '/live-tracking')
  const logout = () => { setSidebarAccountMenuOpen(false); setTopAccountMenuOpen(false); onLogout() }
  const toggleSidebar = () => { if (window.innerWidth <= 700) setSidebarOpen(false); else setSidebarCollapsed((value) => !value) }

  return (
    <div className={`app-shell ${theme} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {sidebarOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? 'mobile-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><Navigation size={18} strokeWidth={2.8} /></div>
          <div>
            <div className="brand-name">trackline</div>
            <div className="brand-caption">TDK SHUTTLE</div>
          </div>
          <button className="sidebar-toggle" onClick={toggleSidebar} title={window.innerWidth <= 700 ? 'Close sidebar' : sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-label={window.innerWidth <= 700 ? 'Close sidebar' : sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}><Menu size={17} /></button>
        </div>

        <div className="workspace-switcher-wrap">
          {/* <button className="workspace-switcher" type="button" onClick={() => setWorkspaceMenuOpen((value) => !value)} aria-expanded={workspaceMenuOpen}>
          <div className="workspace-avatar">M</div>
            <div className="workspace-copy"><strong>TDK Campus</strong><span>{role === 'ADMIN' ? 'Admin view' : role === 'DRIVER' ? 'Driver view' : 'Employee view'}</span></div>
            <ChevronDown size={16} className={`muted-icon ${workspaceMenuOpen ? 'workspace-chevron-open' : ''}`} />
          </button>
          {workspaceMenuOpen && <div className="workspace-menu"><strong>TDK Campus</strong><span>Current workspace</span><button type="button" onClick={() => setWorkspaceMenuOpen(false)}>Continue as {role === 'ADMIN' ? 'Admin' : role === 'DRIVER' ? 'Driver' : 'Employee'}</button></div>} */}
        </div>

        <div className="nav-label">Workspace</div>
        <nav className="main-nav">
          {workspaceItems.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${activeNav === label ? 'active' : ''}`} onClick={() => selectNav(label)} title={sidebarCollapsed ? label : undefined}>
              <Icon size={18} />
              <span>{label}</span>
              {label === 'Live tracking' && <span className="live-dot" />}
            </button>
          ))}
        </nav>

        <div className="nav-label nav-label-spaced">Manage</div>
        <nav className="main-nav">
          {manageItems.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${activeNav === label ? 'active' : ''}`} onClick={() => selectNav(label)} title={sidebarCollapsed ? label : undefined}><Icon size={18} /><span>{label}</span>{label === 'Alerts' && unreadAlerts > 0 && <span className="alert-count">{unreadAlerts > 99 ? '99+' : unreadAlerts}</span>}</button>)}
        </nav>

        <div className="sidebar-spacer" />
        <div className="help-card">
          <div className="help-icon"><CircleHelp size={16} /></div>
          <div><strong>Need a hand?</strong><span>View the tracking guide</span></div>
          <ChevronDown size={15} className="muted-icon" />
        </div>
          <div className="account-row">
          <button className="account-profile-button" onClick={() => setSidebarAccountMenuOpen((value) => !value)} title="Open account menu"><div className="account-avatar">{user.avatar_data ? <img src={user.avatar_data} alt="" /> : user.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</div></button>
          <div className="account-copy"><strong>{user.name}</strong><span>{user.role} account</span></div>
          <button className="account-logout" onClick={() => setSidebarAccountMenuOpen((value) => !value)} title="Open account menu" aria-expanded={sidebarAccountMenuOpen}><MoreHorizontal size={18} className="muted-icon" /></button>
          {sidebarAccountMenuOpen && <div className="account-menu sidebar-account-menu"><button onClick={() => selectNav('Profile')}><CircleUserRound size={15} /> Profile</button><button onClick={logout}><LogOut size={15} /> Logout</button></div>}
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
          <div className="breadcrumb"><span>Workspace</span><span className="slash">/</span><strong>{activeNav}</strong></div>
          <div className="topbar-actions">
            <div className="search-box"><Search size={16} /><input aria-label="Search" placeholder="Search buses, routes..." /></div>
            <button className="icon-button theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle light mode" title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
            <button className="icon-button" onClick={() => notify('No new service alerts')} aria-label="Notifications"><Bell size={18} /><span className="notification-dot" /></button>
            <div className="topbar-divider" />
            <div className="top-account-wrap"><button className="avatar-button" onClick={() => setTopAccountMenuOpen((value) => !value)} title="Open account menu" aria-expanded={topAccountMenuOpen}><span>{user.avatar_data ? <img src={user.avatar_data} alt="" /> : user.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span><ChevronDown size={14} /></button>{topAccountMenuOpen && <div className="account-menu top-account-menu"><button onClick={() => selectNav('Profile')}><CircleUserRound size={15} /> Profile</button><button onClick={logout}><LogOut size={15} /> Logout</button></div>}</div>
          </div>
        </header>

        <div className="page-content">
          {currentRoute.kind !== 'live-tracking' && <WorkspacePage section={activeNav} routeKind={currentRoute.kind} routeParams={currentRoute.params} navigate={navigate} theme={theme} setTheme={setTheme} notify={notify} user={user} onProfileUpdated={onProfileUpdated} routes={routesFromDb} stops={stopsFromDb} shuttles={shuttles} apiShuttles={apiShuttles} settings={settingsFromDb} systemSettings={systemSettingsFromDb} onChanged={() => setDataVersion((value) => value + 1)} onUnreadChange={setUnreadAlerts} onOpenShuttleHistory={(shuttleId) => navigate(`/shuttles/${encodeURIComponent(shuttleId)}`)} historyShuttleId={historyShuttleId} onClearShuttleHistory={() => navigate('/trip-history')} />}
          {currentRoute.kind === 'live-tracking' && <LiveTrackingPage user={user} notify={notify} showSimulator={showSimulator} setShowSimulator={setShowSimulator} shareLiveView={shareLiveView} routeStats={routeStats} shuttles={shuttles} selectedRouteDetails={selectedRouteDetails} simState={simState} simSpeed={simSpeed} setSimSpeed={setSimSpeed} selected={selected} startSimulation={startSimulation} setSimState={setSimState} stopSimulation={stopSimulation} isFocused={isFocused} gpsState={gpsState} gpsMessage={gpsMessage} locateMe={locateMe} liveShuttles={liveShuttles} nearbyShuttles={nearbyShuttles} selectedId={selectedId} setSelectedId={setSelectedId} mapRequest={mapRequest} setMapRequest={setMapRequest} userLocation={userLocation} mapRouteDetails={mapRouteDetails} trackSelected={trackSelected} viewFullRoute={viewFullRoute} visibleStops={visibleStops} />}
        </div>
      </main>
      {toast && <div className="toast"><div className="toast-check"><ShieldCheck size={15} /></div>{toast}<button onClick={() => setToast('')}><X size={15} /></button></div>}
    </div>
  )
}
