export type SessionUser = { id: number; name: string; email: string; role: string; employee_number?: string | null; driver_id?: number | null; avatar_data?: string | null }
export type ApiSeat = { id: number; shuttle_id: string; seat_number: string; row_position: number; column_position: number; seat_type: 'PASSENGER' | 'DRIVER' | 'AISLE' | 'DOOR' | 'EMPTY_SPACE' | string; is_active: number; state?: 'AVAILABLE' | 'HELD' | 'HELD_BY_ME' | 'OCCUPIED' | 'DISABLED'; hold_expires_at?: string | null; passenger_name?: string | null }
export type ApiPassenger = { id: number; trip_id: number; shuttle_id: string; seat_id: number; seat_number: string; user_id: number; employee_number: string; employee_name: string; boarded_at: string; boarded_latitude?: number | null; boarded_longitude?: number | null; employee_boarding_latitude?: number | null; employee_boarding_longitude?: number | null; shuttle_boarding_latitude?: number | null; shuttle_boarding_longitude?: number | null; boarding_stop_id?: number | null; boarding_stop_name?: string | null; status: string; is_test?: number; signature_data?: string | null }
export type ApiBoardingState = { trip: { id: number; trip_code: string; shuttle_id: string; bus_number?: string; route_name?: string; status: string; trip_mode?: string }; capacity: number; occupied: number; available: number; seats: ApiSeat[]; passenger?: ApiPassenger | null; eligibility: { open: boolean; code: string; message: string; employee_distance_meters?: number | null; shuttle_stopped: boolean; stopped_seconds: number; next_stop?: string | null; boarding_stop_id?: number | null; shuttle_location: { latitude: number; longitude: number; speed: number; accuracy?: number | null; recorded_at?: string | null } }; settings: { radius_meters: number; stopped_duration_seconds: number; max_speed_kmh: number; require_pickup_stop: boolean } }
export type ApiShuttle = {
  id: string
  shuttle_code?: string | null
  bus_number?: string | null
  vehicle_name: string
  plate_number: string | null
  vehicle_type?: string | null
  capacity?: number
  gps_device_id?: string | null
  route_id: number | null
  next_stop?: string | null
  status: string
  latitude: number | null
  longitude: number | null
  speed: number
  route: string | null
  driver: string | null
  last_gps_at: string | null
  gps_state?: string | null
}
export type ApiRoute = { id: number; route_code?: string | null; name: string; route_name?: string | null; description: string | null; start_name?: string | null; start_latitude?: number | null; start_longitude?: number | null; destination_name?: string | null; destination_latitude?: number | null; destination_longitude?: number | null; route_geometry?: string | null; total_distance?: number | null; estimated_duration?: number | null; status: string; is_active?: number; stop_count: number }
export type ApiStop = { id: number; pickup_code?: string | null; name: string; address?: string | null; landmark?: string | null; latitude: number; longitude: number; geofence_radius: number; is_active?: number }
export type ApiRouteStop = { stop_id: number; pickup_code?: string | null; pickup_name: string; address?: string | null; landmark?: string | null; latitude: number; longitude: number; sequence: number; estimated_arrival_offset: number; waiting_time_minutes: number; is_active: number }
export type ApiPickupPoint = { id: number; pickup_code: string; pickup_name: string; address?: string | null; landmark?: string | null; latitude: number; longitude: number; is_active: number }
export type ApiRouteDetails = { route: ApiRoute; stops: ApiRouteStop[] }
export type LocationSearchResult = { place_id: number; display_name: string; lat: string; lon: string; address?: { country_code?: string; city?: string; town?: string; municipality?: string } }
export type ApiDriver = { id: number; employee_number: string; driver_name: string; contact_number?: string | null; is_active: number }
export type ApiUser = { id: number; name: string; email: string; role: 'ADMIN' | 'DRIVER' | 'USER' | 'MAIN_GATE'; driver_id?: number | null; driver_name?: string | null; employee_number?: string | null; is_active: number; created_at?: string; updated_at?: string }
export type ApiAssignment = { id: number; shuttle_id: string; route_id: number; driver_id?: number | null; effective_date: string; effective_until?: string | null; status: string; bus_number?: string; route_name?: string; driver_name?: string | null }
export type ApiSchedule = { id: number; route_id: number; departure_time: string; expected_tdk_arrival?: string | null; days_of_week: string; is_active: number; route_name?: string }
export type ApiTrip = { id: number; trip_code: string; shuttle_id: string; route_id?: number | null; driver_id?: number | null; schedule_id?: number | null; trip_date: string; started_at: string; arrived_at_tdk?: string | null; ended_at?: string | null; status: string; gps_state?: string; trip_mode?: 'REAL' | 'SIMULATION' | string; ended_manually?: number; end_reason?: string | null; route_geometry?: string | null; latitude?: number | null; longitude?: number | null; speed?: number | null; heading?: number | null; bus_number?: string; route_name?: string; driver_name?: string | null }
export type MainGateTrip = { id: number; trip_code: string; trip_date: string; shuttle_id: string; shuttle_code: string; route_id: number | null; route_name: string | null; driver_name: string | null; started_at: string; arrived_at_tdk: string | null; eta_at_tdk: string | null; ended_at: string | null; status: string; gps_state: string; capacity: number; passenger_count: number; test_passenger_count: number; available_seats: number; current_stop: string | null; latitude: number | null; longitude: number | null; last_gps_at: string | null; distance_to_tdk_meters: number | null; approaching_tdk: boolean }
export type MainGatePassenger = { id: number; seat_number: string; employee_number: string; employee_name: string; boarded_at: string; boarding_stop_name: string | null; boarded_latitude: number | null; boarded_longitude: number | null; signature_data: string | null; is_test: number; verification_status: 'PENDING' | 'VERIFIED'; verified_at: string | null; verified_by_name: string | null }
export type MainGateSchedule = { schedule_id: number; shuttle_id: string; shuttle_code: string; route_name: string; driver_name: string | null; capacity: number; departure_at: string; eta_at_tdk: string | null }
export type MainGateToday = { date: string; summary: { incomingShuttles: number; currentlyEnRoute: number; arrivedAtTdk: number; expectedPassengers: number; boardedPassengers: number }; trips: MainGateTrip[]; scheduled: MainGateSchedule[] }
export type ApiTripMessage = { id: number; trip_id: number; shuttle_id: string; sender_user_id?: number | null; sender_name?: string | null; sender_role: string; message_type: string; severity: 'INFO' | 'WARNING' | 'CRITICAL' | string; message: string; reply_to_message_id?: number | null; route_stop_id?: number | null; stop_name?: string | null; latitude?: number | null; longitude?: number | null; is_pinned: number; is_edited: number; is_deleted: number; created_at: string; updated_at: string }
export type ApiAlert = { id: number; trip_id?: number | null; shuttle_id?: string | null; created_by?: number | null; alert_type: string; severity: 'INFO' | 'WARNING' | 'CRITICAL' | string; title: string; message: string; latitude?: number | null; longitude?: number | null; resolved_at?: string | null; created_at: string; read_at?: string | null; bus_number?: string | null; route_name?: string | null }
export type SimulationSnapshot = { tripId: number; shuttleId: string; tripCode: string; routeId: number; speedKmh: number; multiplier: number; status: string; latitude: number; longitude: number; heading: number; distanceTraveledMeters: number; remainingDistanceMeters: number; totalDistanceMeters: number; progress: number; nextStop?: string | null; currentStop?: string | null; distanceToNextStopMeters: number; etaNextStopMinutes?: number | null; etaTdkMinutes?: number | null; completedStops: number; totalStops: number; gpsPointsGenerated: number; source: string; waiting: boolean; updatedAt: string }

const apiBase = import.meta.env.VITE_API_URL || '/api'

async function request<T>(path: string, options: RequestInit = {}) {
  const token = window.localStorage.getItem('trackline-token')
  if (token && token.length > 8192) {
    window.localStorage.removeItem('trackline-token')
    throw new Error('Session expired. Please sign in again.')
  }
  try {
    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) },
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.message || `Request failed (${response.status})`)
    return body as T
  } catch (error) {
    if (error instanceof TypeError) throw new Error(`Cannot connect to Trackline API at ${apiBase}. Start it with "npm run dev:all".`)
    throw error
  }
}

async function downloadFile(path: string) {
  const token = window.localStorage.getItem('trackline-token')
  if (!token || token.length > 8192) throw new Error('Please sign in again.')
  const response = await fetch(`${apiBase}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.message || `Download failed (${response.status})`)
  }
  const filename = /filename="?([^";]+)"?/.exec(response.headers.get('Content-Disposition') || '')?.[1] || 'incoming_manifest.xlsx'
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export const api = {
  mainGateToday: () => request<MainGateToday>('/main-gate/today'),
  mainGateHistory: (filters: Record<string, string>) => request<{ trips: MainGateTrip[] }>(`/main-gate/history?${new URLSearchParams(filters)}`),
  mainGateManifest: (id: number) => request<{ trip: MainGateTrip; passengers: MainGatePassenger[] }>(`/main-gate/trips/${id}/manifest`),
  mainGateVerify: (id: number, passengerId: number) => request<{ ok: boolean }>(`/main-gate/trips/${id}/verify`, { method: 'POST', body: JSON.stringify({ passengerId }) }),
  mainGateVerifyAll: (id: number) => request<{ ok: boolean; verified: number }>(`/main-gate/trips/${id}/verify-all`, { method: 'POST', body: JSON.stringify({ reviewed: true }) }),
  mainGateExportToday: () => downloadFile('/main-gate/today/export'),
  mainGateExportTrip: (id: number) => downloadFile(`/main-gate/trips/${id}/export`),
  login: (email: string, password: string) => request<{ token: string; user: SessionUser }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request<{ user: SessionUser }>('/auth/me'),
  profile: () => request<{ user: SessionUser & { driver_name?: string | null; employee_number?: string | null } }>('/profile'),
  updateProfile: (payload: { name: string; email: string; currentPassword?: string; newPassword?: string; avatarData?: string | null }) => request<{ user: SessionUser; token: string }>('/profile', { method: 'PATCH', body: JSON.stringify(payload) }),
  users: () => request<{ users: ApiUser[] }>('/users'),
  createUser: (payload: unknown) => request<{ user: ApiUser }>('/users', { method: 'POST', body: JSON.stringify(payload) }),
  updateUser: (id: number, payload: unknown) => request<{ user: ApiUser }>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteUser: (id: number) => request<{ ok: boolean }>(`/users/${id}`, { method: 'DELETE' }),
  permanentlyDeleteUser: (id: number) => request<{ ok: boolean }>(`/users/${id}?permanent=1`, { method: 'DELETE' }),
  routes: () => request<{ routes: ApiRoute[] }>('/routes'),
  route: (id: number) => request<ApiRouteDetails>(`/routes/${id}`),
  stops: () => request<{ stops: ApiStop[] }>('/stops'),
  pickupPoints: () => request<{ pickupPoints: ApiPickupPoint[] }>('/pickup-points'),
  shuttles: () => request<{ shuttles: ApiShuttle[] }>('/shuttles'),
  settings: () => request<{ settings: Record<string, string> }>('/settings'),
  updateSetting: (key: string, value: string) => request<{ key: string; value: string }>(`/settings/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify({ value }) }),
  createRoute: (payload: unknown) => request<{ route: ApiRoute }>('/routes', { method: 'POST', body: JSON.stringify(payload) }),
  updateRoute: (id: number, payload: unknown) => request<{ route: ApiRoute }>(`/routes/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteRoute: (id: number) => request<{ ok: boolean }>(`/routes/${id}`, { method: 'DELETE' }),
  permanentlyDeleteRoute: (id: number) => request<{ ok: boolean }>(`/routes/${id}?permanent=1`, { method: 'DELETE' }),
  createShuttle: (payload: { id: string; vehicleName: string; plateNumber: string; routeId: number | null }) => request<{ shuttle: ApiShuttle }>('/shuttles', { method: 'POST', body: JSON.stringify(payload) }),
  updateShuttle: (id: string, payload: { vehicleName: string; plateNumber: string; routeId: number | null; status: string }) => request<{ shuttle: ApiShuttle }>(`/shuttles/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteShuttle: (id: string) => request<{ ok: boolean }>(`/shuttles/${encodeURIComponent(id)}?permanent=1`, { method: 'DELETE' }),
  permanentlyDeleteShuttle: (id: string) => request<{ ok: boolean }>(`/shuttles/${encodeURIComponent(id)}?permanent=1`, { method: 'DELETE' }),
  shuttleSeats: (id: string) => request<{ shuttle: { id: string; bus_number?: string; capacity: number }; seats: ApiSeat[] }>(`/shuttles/${encodeURIComponent(id)}/seats`),
  updateShuttleSeats: (id: string, seats: unknown[]) => request<{ seats: ApiSeat[] }>(`/shuttles/${encodeURIComponent(id)}/seats`, { method: 'PUT', body: JSON.stringify({ seats }) }),
  startTrip: (payload: { shuttleId: string; routeId?: number | null; driverId?: number | null; scheduleId?: number | null }) => request<{ trip: { id: number; shuttle_id: string; trip_code?: string } }>('/trips/start', { method: 'POST', body: JSON.stringify(payload) }),
  activeDriverTrip: () => request<{ trip: ApiTrip | null }>('/driver/active-trip'),
  pauseTrip: (id: number) => request<{ trip: ApiTrip }>(`/trips/${id}/pause`, { method: 'POST' }),
  resumeTrip: (id: number) => request<{ trip: ApiTrip }>(`/trips/${id}/resume`, { method: 'POST' }),
  endTrip: (id: number, reason?: string) => request<{ trip: ApiTrip }>(`/trips/${id}/end`, { method: 'POST', body: JSON.stringify({ reason }) }),
  sendTripLocation: (id: number, payload: { latitude: number; longitude: number; speed?: number; heading?: number; accuracy?: number; timestamp?: string; clientId?: string }) => request<{ ok: boolean; nextStop?: string | null; status?: string }>(`/trips/${id}/location`, { method: 'POST', body: JSON.stringify(payload) }),
  activeSimulation: () => request<{ simulation: SimulationSnapshot | null }>('/simulation/active'),
  startSimulation: (payload: { shuttleId: string; routeId: number; driverId?: number | null; scheduleId?: number | null; speedKmh?: number; multiplier?: number; restart?: boolean }) => request<{ trip: ApiTrip; simulation: SimulationSnapshot }>('/simulation/start', { method: 'POST', body: JSON.stringify(payload) }),
  pauseSimulation: (id: number) => request<{ trip: ApiTrip; simulation: SimulationSnapshot }>(`/simulation/${id}/pause`, { method: 'POST' }),
  resumeSimulation: (id: number) => request<{ trip: ApiTrip; simulation: SimulationSnapshot }>(`/simulation/${id}/resume`, { method: 'POST' }),
  stopSimulation: (id: number) => request<{ trip: ApiTrip; simulation: SimulationSnapshot }>(`/simulation/${id}/stop`, { method: 'POST' }),
  latestLocation: (id: string) => request<{ location: ApiShuttle | null }>(`/shuttles/${encodeURIComponent(id)}/location/latest`),
  createPickupPoint: (payload: unknown) => request<{ pickupPoint: ApiPickupPoint }>('/pickup-points', { method: 'POST', body: JSON.stringify(payload) }),
  updatePickupPoint: (id: number, payload: unknown) => request<{ pickupPoint: ApiPickupPoint }>(`/pickup-points/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deletePickupPoint: (id: number) => request<{ ok: boolean }>(`/pickup-points/${id}`, { method: 'DELETE' }),
  permanentlyDeletePickupPoint: (id: number) => request<{ ok: boolean }>(`/pickup-points/${id}?permanent=1`, { method: 'DELETE' }),
  drivers: () => request<{ drivers: ApiDriver[] }>('/drivers'),
  createDriver: (payload: unknown) => request<{ driver: ApiDriver }>('/drivers', { method: 'POST', body: JSON.stringify(payload) }),
  updateDriver: (id: number, payload: unknown) => request<{ driver: ApiDriver }>(`/drivers/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteDriver: (id: number) => request<{ ok: boolean }>(`/drivers/${id}`, { method: 'DELETE' }),
  permanentlyDeleteDriver: (id: number) => request<{ ok: boolean }>(`/drivers/${id}?permanent=1`, { method: 'DELETE' }),
  assignments: () => request<{ assignments: ApiAssignment[] }>('/shuttle-assignments'),
  createAssignment: (payload: unknown) => request<{ assignment: ApiAssignment }>('/shuttle-assignments', { method: 'POST', body: JSON.stringify(payload) }),
  updateAssignment: (id: number, payload: unknown) => request<{ assignment: ApiAssignment }>(`/shuttle-assignments/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  permanentlyDeleteAssignment: (id: number) => request<{ ok: boolean }>(`/shuttle-assignments/${id}?permanent=1`, { method: 'DELETE' }),
  schedules: () => request<{ schedules: ApiSchedule[] }>('/trip-schedules'),
  createSchedule: (payload: unknown) => request<{ schedule: ApiSchedule }>('/trip-schedules', { method: 'POST', body: JSON.stringify(payload) }),
  updateSchedule: (id: number, payload: unknown) => request<{ schedule: ApiSchedule }>(`/trip-schedules/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteSchedule: (id: number) => request<{ ok: boolean }>(`/trip-schedules/${id}`, { method: 'DELETE' }),
  permanentlyDeleteSchedule: (id: number) => request<{ ok: boolean }>(`/trip-schedules/${id}?permanent=1`, { method: 'DELETE' }),
  trips: () => request<{ trips: ApiTrip[] }>('/trips'),
  activeTrips: () => request<{ trips: ApiTrip[] }>('/trips/active'),
  trip: (id: number) => request<{ trip: ApiTrip; stopStatus: Array<{ stop_id: number; pickup_name: string; latitude: number; longitude: number; status: string; arrived_at?: string | null; departed_at?: string | null }>; locations: Array<{ latitude: number; longitude: number; speed: number; recorded_at: string; accuracy?: number | null }>; messages: ApiTripMessage[] }>(`/trips/${id}`),
  tripBoarding: (id: number, location: { latitude: number; longitude: number; accuracy?: number | null }) => request<ApiBoardingState>(`/trips/${id}/boarding?${new URLSearchParams({ latitude: String(location.latitude), longitude: String(location.longitude), ...(location.accuracy === undefined || location.accuracy === null ? {} : { accuracy: String(location.accuracy) }) }).toString()}`),
  holdTripSeat: (id: number, seatId: number, location: { latitude: number; longitude: number; accuracy?: number | null }) => request<{ hold: { tripId: number; seatId: number; seatNumber: string; expiresAt: string } }>(`/trips/${id}/seat-holds`, { method: 'POST', body: JSON.stringify({ seatId, ...location }) }),
  releaseTripSeatHold: (id: number, seatId: number) => request<{ ok: boolean }>(`/trips/${id}/seat-holds/${seatId}`, { method: 'DELETE' }),
  boardTrip: (id: number, payload: { seatId: number; signatureData: string; latitude: number; longitude: number; accuracy?: number | null }) => request<{ passenger: ApiPassenger; seatNumber: string; occupancyCount: number; availableCount: number }>(`/trips/${id}/board`, { method: 'POST', body: JSON.stringify(payload) }),
  addTestPassenger: (id: number, payload: { seatId: number; employeeNumber: string; employeeName: string; signatureData?: string }) => request<{ passenger: ApiPassenger; occupancyCount: number }>(`/trips/${id}/passengers/test`, { method: 'POST', body: JSON.stringify(payload) }),
  hideTestPassenger: (tripId: number, passengerId: number) => request<{ ok: boolean; hidden: boolean }>(`/trips/${tripId}/passengers/test/${passengerId}`, { method: 'PATCH', body: JSON.stringify({ hidden: true }) }),
  removeTestPassenger: (tripId: number, passengerId: number) => request<{ ok: boolean; deleted: boolean }>(`/trips/${tripId}/passengers/test/${passengerId}`, { method: 'DELETE' }),
  tripPassengers: (id: number, includeHidden = false, testMode = false) => { const query = new URLSearchParams(); if (includeHidden) query.set('includeHidden', '1'); if (testMode) query.set('testMode', '1'); const suffix = query.toString(); return request<{ passengers: ApiPassenger[]; can_view_signatures: boolean; test_mode?: boolean }>(`/trips/${id}/passengers${suffix ? `?${suffix}` : ''}`) },
  tripStopStatus: (id: number) => request<{ stopStatus: Array<{ stop_id: number; pickup_name: string; status: string; arrived_at?: string | null; departed_at?: string | null }> }>(`/trips/${id}/stop-status`),
  tripMessages: (id: number, limit = 100) => request<{ messages: ApiTripMessage[] }>(`/trips/${id}/messages?limit=${limit}`),
  sendTripMessage: (id: number, payload: { message: string; messageType?: string; severity?: string; title?: string; alertType?: string; routeStopId?: number | null; replyToMessageId?: number | null }) => request<{ message: ApiTripMessage }>(`/trips/${id}/messages`, { method: 'POST', body: JSON.stringify(payload) }),
  sendQuickTripUpdate: (id: number, payload: { kind: string; message?: string }) => request<{ message: ApiTripMessage }>(`/trips/${id}/messages/quick`, { method: 'POST', body: JSON.stringify(payload) }),
  pinTripMessage: (id: number, isPinned: boolean) => request<{ message: ApiTripMessage }>(`/trip-messages/${id}`, { method: 'PATCH', body: JSON.stringify({ isPinned }) }),
  deleteTripMessage: (id: number) => request<{ message: ApiTripMessage }>(`/trip-messages/${id}`, { method: 'DELETE' }),
  followTrip: (id: number) => request<{ following: boolean }>(`/trips/${id}/follow`, { method: 'POST' }),
  unfollowTrip: (id: number) => request<{ following: boolean }>(`/trips/${id}/follow`, { method: 'DELETE' }),
  tripFollowStatus: (id: number) => request<{ following: boolean }>(`/trips/${id}/follow`),
  alerts: (params: { unread?: boolean; severity?: string; limit?: number } = {}) => request<{ alerts: ApiAlert[]; unreadCount: number }>(`/alerts?${new URLSearchParams({ ...(params.unread ? { unread: '1' } : {}), ...(params.severity ? { severity: params.severity } : {}), limit: String(params.limit || 100) }).toString()}`),
  unreadAlertCount: () => request<{ count: number }>('/alerts/unread-count'),
  markAlertRead: (id: number) => request<{ ok: boolean }>(`/alerts/${id}/read`, { method: 'POST' }),
  markAllAlertsRead: () => request<{ ok: boolean }>('/alerts/read-all', { method: 'POST' }),
  resolveAlert: (id: number) => request<{ alert: ApiAlert }>(`/alerts/${id}/resolve`, { method: 'POST' }),
  tripLocationHistory: (id: number) => request<{ locations: Array<{ latitude: number; longitude: number; speed: number; recorded_at: string; accuracy?: number | null }> }>(`/trips/${id}/location-history`),
  systemSettings: () => request<{ settings: Record<string, string> }>('/system-settings'),
  updateSystemSetting: (key: string, value: string) => request<{ key: string; value: string }>(`/system-settings/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify({ value }) }),
  searchLocation: (query: string) => request<{ results: LocationSearchResult[] }>(`/location/search?q=${encodeURIComponent(query)}`),
  reverseLocation: (latitude: number, longitude: number) => request<{ result: LocationSearchResult }>(`/location/reverse?lat=${latitude}&lon=${longitude}`),
  routeGeometry: (coordinates: Array<[number, number]>) => request<{ geometry: Array<[number, number]>; distanceMeters: number; durationSeconds: number }>(`/routing/route?coordinates=${coordinates.map(([latitude, longitude]) => `${latitude},${longitude}`).join('|')}`),
  createMaintenanceShuttle: (payload: unknown) => request<{ shuttle: ApiShuttle; routeId: number }>('/maintenance/shuttles', { method: 'POST', body: JSON.stringify(payload) }),
  updateMaintenanceShuttle: (id: string, payload: unknown) => request<{ shuttle: ApiShuttle; routeId: number }>(`/maintenance/shuttles/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) }),
}

export function saveSession(token: string) {
  window.localStorage.setItem('trackline-token', token)
}

export function clearSession() {
  window.localStorage.removeItem('trackline-token')
}
