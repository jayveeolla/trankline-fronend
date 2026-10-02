import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, BusFront, Check, Eye, Grid2X2, MapPin, Plus, Save, Search, Settings, Trash2, Users, X } from 'lucide-react'
import { api, type ApiPickupPoint, type ApiRoute, type ApiRouteDetails, type ApiShuttle, type LocationSearchResult } from './api'
import RouteBuilderMap, { type BuilderLocation, type BuilderStop } from './RouteBuilderMap'
type Props = { routes: ApiRoute[]; shuttle?: ApiShuttle | null; notify: (message: string) => void; onSaved: () => void; onCancel: () => void }
type RouteMode = 'existing' | 'new'
type SeatLayoutDraft = { seatNumber: string; row: number; column: number; seatType: 'PASSENGER' | 'DRIVER' | 'AISLE' | 'DOOR' | 'EMPTY_SPACE'; isActive: boolean }

const emptyStart: BuilderLocation = { name: '', address: '', latitude: 14.2111, longitude: 121.1655 }
const layoutColumnCount = (capacity: number) => capacity <= 24 ? 3 : 4
function defaultSeatLayout(capacity: number): SeatLayoutDraft[] {
  const columns = layoutColumnCount(capacity)
  return Array.from({ length: Math.max(1, capacity) }, (_, index) => ({ seatNumber: String(index + 1).padStart(2, '0'), row: Math.floor(index / columns) + 1, column: (index % columns) + 1, seatType: 'PASSENGER', isActive: true }))
}
const defaultTdk: BuilderLocation = { name: 'TDK', address: 'TDK Philippines Corporation, 119 E Science Ave, Laguna Technopark, Biñan, Laguna', latitude: 14.2724796, longitude: 121.0632645 }

export default function ShuttleWizard({ routes, shuttle, notify, onSaved, onCancel }: Props) {
  const isEditing = Boolean(shuttle)
  const [form, setForm] = useState({ shuttleCode: shuttle?.shuttle_code || shuttle?.id || '', busNumber: shuttle?.bus_number || shuttle?.id || '', plateNumber: shuttle?.plate_number || '', vehicleType: shuttle?.vehicle_type || shuttle?.vehicle_name || '', capacity: String(shuttle?.capacity || 40), gpsDeviceId: shuttle?.gps_device_id || '', status: shuttle?.status || 'READY' })
  const [routeMode, setRouteMode] = useState<RouteMode>(shuttle?.route_id ? 'existing' : 'new')
  const [existingRouteId, setExistingRouteId] = useState(String(shuttle?.route_id || ''))
  const [route, setRoute] = useState({ routeCode: '', routeName: '', description: '' })
  const [start, setStart] = useState<BuilderLocation | null>(null)
  const [stops, setStops] = useState<BuilderStop[]>([])
  const [tdk, setTdk] = useState(defaultTdk)
  const [pickupPoints, setPickupPoints] = useState<ApiPickupPoint[]>([])
  const [selectedPickupPoint, setSelectedPickupPoint] = useState('')
  const [geometry, setGeometry] = useState<Array<[number, number]>>([])
  const [distanceMeters, setDistanceMeters] = useState(0)
  const [durationSeconds, setDurationSeconds] = useState(0)
  const [mapMode, setMapMode] = useState<'idle' | 'start' | 'stop'>('idle')
  const [pending, setPending] = useState<{ latitude: number; longitude: number; name: string; address: string; waitingTimeMinutes: string } | null>(null)
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([])
  const [searchTarget, setSearchTarget] = useState<'start' | 'stop'>('start')
  const [saving, setSaving] = useState(false)
  const [loadingRoute, setLoadingRoute] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [duplicateSharedRoute, setDuplicateSharedRoute] = useState(false)
  const [stopsDirty, setStopsDirty] = useState(false)
  const [seatLayout, setSeatLayout] = useState<SeatLayoutDraft[]>(() => defaultSeatLayout(Number(shuttle?.capacity || 40)))
  const [activeTab, setActiveTab] = useState<'route' | 'general' | 'seats' | 'assignment' | 'settings'>('route')
  const [selectedSeatNumber, setSelectedSeatNumber] = useState('')
  const stopsSnapshot = useRef('')
  useEffect(() => {
    if (!stops.length) return
    setStops((current) => current.slice().sort((a, b) => a.sequence - b.sequence).map((stop, index) => ({ ...stop, sequence: index + 1 })))
  }, [stops.length])

  useEffect(() => {
    const snapshot = JSON.stringify(stops)
    if (loadingRoute) { stopsSnapshot.current = snapshot; return }
    if (stopsSnapshot.current && stopsSnapshot.current !== snapshot) setStopsDirty(true)
    stopsSnapshot.current = snapshot
  }, [loadingRoute, stops])

  useEffect(() => {
    api.systemSettings().then(({ settings }) => setTdk({ name: settings.TDK_NAME || 'TDK', address: 'TDK final destination', latitude: Number(settings.TDK_LATITUDE || defaultTdk.latitude), longitude: Number(settings.TDK_LONGITUDE || defaultTdk.longitude) })).catch(() => undefined)
    api.pickupPoints().then(({ pickupPoints: points }) => setPickupPoints(points.filter((point) => point.is_active !== 0))).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!shuttle?.id) {
      setSeatLayout(defaultSeatLayout(Number(form.capacity) || 1))
      return
    }
    api.shuttleSeats(shuttle.id).then(({ seats }) => setSeatLayout(seats.map((seat) => ({ seatNumber: seat.seat_number, row: Number(seat.row_position), column: Number(seat.column_position), seatType: (seat.seat_type || 'PASSENGER') as SeatLayoutDraft['seatType'], isActive: Boolean(seat.is_active) })))).catch(() => notify('Could not load the shuttle seat layout'))
  }, [shuttle?.id])

  useEffect(() => {
    if (!shuttle?.route_id) {
      setStart(null)
      return
    }
    setLoadingRoute(true)
    api.route(shuttle.route_id).then((details: ApiRouteDetails) => {
      const source = details.route
      setRoute({ routeCode: source.route_code || '', routeName: source.route_name || source.name, description: source.description || '' })
      setStart(source.start_latitude !== null && source.start_latitude !== undefined && source.start_longitude !== null && source.start_longitude !== undefined ? { name: source.start_name || '', address: '', latitude: Number(source.start_latitude), longitude: Number(source.start_longitude) } : null)
      setStops(details.stops.map((stop) => ({ pickupCode: stop.pickup_code || undefined, pickupName: stop.pickup_name, address: stop.address || '', latitude: Number(stop.latitude), longitude: Number(stop.longitude), sequence: Number(stop.sequence), waitingTimeMinutes: Number(stop.waiting_time_minutes || 0) })))
      setStopsDirty(false)
      if (source.route_geometry) {
        try { setGeometry(typeof source.route_geometry === 'string' ? JSON.parse(source.route_geometry) : source.route_geometry) } catch { setGeometry([]) }
      }
    }).catch(() => notify('Could not load the assigned route')).finally(() => setLoadingRoute(false))
  }, [shuttle?.route_id])

  useEffect(() => {
    if (routeMode !== 'existing' || !existingRouteId || shuttle?.route_id === Number(existingRouteId)) return
    setStopsDirty(false)
    setLoadingRoute(true)
    api.route(Number(existingRouteId)).then((details) => {
      const source = details.route
      setRoute({ routeCode: source.route_code || '', routeName: source.route_name || source.name, description: source.description || '' })
      setStart(source.start_latitude !== null && source.start_latitude !== undefined && source.start_longitude !== null && source.start_longitude !== undefined ? { name: source.start_name || '', address: '', latitude: Number(source.start_latitude), longitude: Number(source.start_longitude) } : null)
      setStops(details.stops.map((stop) => ({ pickupCode: stop.pickup_code || undefined, pickupName: stop.pickup_name, address: stop.address || '', latitude: Number(stop.latitude), longitude: Number(stop.longitude), sequence: Number(stop.sequence), waitingTimeMinutes: Number(stop.waiting_time_minutes || 0) })))
      setStopsDirty(false)
      if (source.route_geometry) { try { setGeometry(typeof source.route_geometry === 'string' ? JSON.parse(source.route_geometry) : source.route_geometry) } catch { setGeometry([]) } }
    }).catch(() => notify('Could not load the selected route')).finally(() => setLoadingRoute(false))
  }, [existingRouteId, routeMode, shuttle?.route_id])

  useEffect(() => {
    if (!start || !stops.length || (routeMode !== 'new' && !stopsDirty)) return
    const points: Array<[number, number]> = [[start.latitude, start.longitude], ...stops.slice().sort((a, b) => a.sequence - b.sequence).map((stop) => [stop.latitude, stop.longitude] as [number, number]), [tdk.latitude, tdk.longitude]]
    const timer = window.setTimeout(() => {
      api.routeGeometry(points).then((result) => { setGeometry(result.geometry); setDistanceMeters(result.distanceMeters); setDurationSeconds(result.durationSeconds) }).catch(() => { setGeometry([]); notify('Road routing is temporarily unavailable; the map will show the point sequence.') })
    }, 450)
    return () => window.clearTimeout(timer)
  }, [routeMode, start, stops, stopsDirty, tdk])

  const sortedStops = useMemo(() => stops.slice().sort((a, b) => a.sequence - b.sequence), [stops])
  const updateForm = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }))
  const updateStop = (index: number, patch: Partial<BuilderStop>) => { setStops((current) => current.map((stop, stopIndex) => stopIndex === index ? { ...stop, ...patch } : stop)); setStopsDirty(true) }
  const updateSeat = (index: number, key: keyof SeatLayoutDraft, value: string | boolean) => setSeatLayout((current) => current.map((seat, seatIndex) => seatIndex === index ? { ...seat, [key]: key === 'row' || key === 'column' ? Math.max(1, Number(value) || 1) : value } as SeatLayoutDraft : seat))
  const addSeat = () => setSeatLayout((current) => { const columns = Math.max(1, ...current.map((seat) => seat.column), layoutColumnCount(Number(form.capacity) || current.length + 1)); return [...current, { seatNumber: String(current.length + 1).padStart(2, '0'), row: Math.floor(current.length / columns) + 1, column: (current.length % columns) + 1, seatType: 'PASSENGER', isActive: true }] })
  const removeSeat = (index: number) => setSeatLayout((current) => {
    const remaining = current.filter((_, seatIndex) => seatIndex !== index)
    const columns = Math.max(1, ...remaining.filter((seat) => seat.seatType === 'PASSENGER' && seat.isActive).map((seat) => seat.column), layoutColumnCount(Number(form.capacity) || remaining.length))
    return remaining.map((seat, seatIndex) => ({ ...seat, seatNumber: String(seatIndex + 1).padStart(2, '0'), row: Math.floor(seatIndex / columns) + 1, column: seatIndex % columns + 1 }))
  })

  const runSearch = async (event: React.FormEvent) => {
    event.preventDefault()
    await searchLocations()
  }

  const searchLocations = async () => {
    if (search.trim().length < 2) return
    try { setSearchResults((await api.searchLocation(search.trim())).results) } catch (error) { notify(error instanceof Error ? error.message : 'Location search failed') }
  }

  const selectSearchResult = (result: LocationSearchResult) => {
    const location = { name: result.display_name.split(',')[0], address: result.display_name, latitude: Number(result.lat), longitude: Number(result.lon) }
    if (searchTarget === 'start') { setStart(location); setStopsDirty(true) }
    else setPending((current) => ({ latitude: location.latitude, longitude: location.longitude, name: location.name, address: location.address || '', waitingTimeMinutes: current?.waitingTimeMinutes || '0' }))
    setSearchResults([]); setSearch(''); setMapMode('idle')
  }

  const handleMapClick = async (latitude: number, longitude: number) => {
    if (mapMode === 'idle') return
    try {
      const { result } = await api.reverseLocation(latitude, longitude)
      const locationName = result.display_name.split(',')[0]
      if (mapMode === 'start') { setStart({ name: locationName, address: result.display_name, latitude, longitude }); setStopsDirty(true) }
      else setPending({ latitude, longitude, name: locationName, address: result.display_name, waitingTimeMinutes: '0' })
    } catch { if (mapMode === 'start') { setStart({ name: 'Selected Philippine location', latitude, longitude }); setStopsDirty(true) } else setPending({ latitude, longitude, name: 'New pickup point', address: '', waitingTimeMinutes: '0' }) }
    setMapMode('idle')
  }

  const addPendingStop = () => {
    if (!pending?.name.trim()) return
    setStops((current) => [...current, { pickupName: pending.name.trim(), address: pending.address, latitude: pending.latitude, longitude: pending.longitude, sequence: current.length + 1, waitingTimeMinutes: Number(pending.waitingTimeMinutes) || 0 }])
    setStopsDirty(true)
    setPending(null)
  }

  const addExistingPickupPoint = () => {
    const point = pickupPoints.find((item) => String(item.id) === selectedPickupPoint)
    if (!point) return
    setStops((current) => [...current, { pickupCode: point.pickup_code, pickupName: point.pickup_name, address: point.address || '', latitude: Number(point.latitude), longitude: Number(point.longitude), sequence: current.length + 1, waitingTimeMinutes: 0 }])
    setStopsDirty(true)
    setSelectedPickupPoint('')
  }

  const removeStop = (index: number) => { setStops((current) => current.filter((_, itemIndex) => itemIndex !== index).map((stop, itemIndex) => ({ ...stop, sequence: itemIndex + 1 }))); setStopsDirty(true) }
  const reorderStop = (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) return
    setStops((current) => { const next = current.slice(); const [item] = next.splice(dragIndex, 1); next.splice(targetIndex, 0, item); return next.map((stop, index) => ({ ...stop, sequence: index + 1 })) })
    setStopsDirty(true)
    setDragIndex(null)
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (routeMode === 'new' && (!start || !route.routeCode || !route.routeName)) return notify('Add a route code, route name, and starting location first.')
    if (routeMode === 'existing' && !existingRouteId) return notify('Select an existing incoming route first.')
    setSaving(true)
    try {
      const activePassengerSeats = seatLayout.filter((seat) => seat.seatType === 'PASSENGER' && seat.isActive)
      if (activePassengerSeats.length !== Number(form.capacity)) throw new Error(`Seat layout must contain exactly ${form.capacity} active passenger seats.`)
      const routeSetup = routeMode === 'new' || (editingAssignedRoute && stopsDirty) ? { ...route, startName: start?.name, startLatitude: start?.latitude, startLongitude: start?.longitude, stops: sortedStops, routeGeometry: geometry, totalDistance: distanceMeters, estimatedDuration: Math.round(durationSeconds / 60) } : null
      const payload = { shuttleCode: form.shuttleCode, busNumber: form.busNumber, plateNumber: form.plateNumber, vehicleType: form.vehicleType, capacity: Number(form.capacity), gpsDeviceId: form.gpsDeviceId, status: form.status, duplicateRoute: duplicateSharedRoute, existingRouteId: routeMode === 'existing' && !editingAssignedRoute ? Number(existingRouteId) : null, routeSetup }
      const saved = shuttle ? await api.updateMaintenanceShuttle(shuttle.id, payload) : await api.createMaintenanceShuttle(payload)
      await api.updateShuttleSeats(saved.shuttle.id, seatLayout)
      notify(shuttle ? 'Shuttle and route updated in database' : 'Shuttle, route, stops, and assignment saved')
      onSaved()
    } catch (error) { notify(error instanceof Error ? error.message : 'Could not save shuttle setup') } finally { setSaving(false) }
  }

  const routeSearch = <><form className="builder-search" onSubmit={runSearch}><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search Philippine ${searchTarget === 'start' ? 'starting location' : 'pickup stop'}`} /><button type="submit" title="Search"><Search size={14} /></button></form>{searchResults.length > 0 && <div className="location-results">{searchResults.map((result) => <button type="button" key={result.place_id} onClick={() => selectSearchResult(result)}>{result.display_name}</button>)}</div>}</>

  const seatLayoutEditor = <section className="wizard-section"><div className="wizard-section-heading"><strong>2. Seat layout</strong><span>{seatLayout.filter((seat) => seat.seatType === 'PASSENGER' && seat.isActive).length}/{form.capacity} active passenger seats</span></div><p className="wizard-help">Configure seat numbers and the visual bus layout used for live boarding. Driver, aisle, door, and empty-space cells are not bookable.</p><div className="seat-layout-editor">{seatLayout.map((seat, index) => <div className="seat-layout-row" key={`${seat.seatNumber}-${index}`}><input aria-label="Seat number" value={seat.seatNumber} onChange={(event) => updateSeat(index, 'seatNumber', event.target.value.toUpperCase())} placeholder="01" /><input aria-label="Seat row" type="number" min="1" value={seat.row} onChange={(event) => updateSeat(index, 'row', event.target.value)} /><input aria-label="Seat column" type="number" min="1" max="4" value={seat.column} onChange={(event) => updateSeat(index, 'column', event.target.value)} /><select aria-label="Seat type" value={seat.seatType} onChange={(event) => updateSeat(index, 'seatType', event.target.value)}><option value="PASSENGER">Passenger</option><option value="DRIVER">Driver</option><option value="AISLE">Aisle</option><option value="DOOR">Door</option><option value="EMPTY_SPACE">Empty space</option></select><label className="seat-active-toggle"><input type="checkbox" checked={seat.isActive} onChange={(event) => updateSeat(index, 'isActive', event.target.checked)} /> Active</label><button type="button" className="remove" onClick={() => removeSeat(index)} title="Remove cell"><X size={13} /></button></div>)}<button type="button" className="secondary-button compact" onClick={addSeat}>+ Add layout cell</button></div></section>

  const selectedNumber = selectedSeatNumber || seatLayout[0]?.seatNumber || ''
  const selectedSeat = seatLayout.find((seat) => seat.seatNumber === selectedNumber) || null
  const seatPosition = (seat: SeatLayoutDraft) => ({ row: Math.max(1, Number(seat.row) || 1), column: Math.max(1, Number(seat.column) || 1) })
  const maxSeatColumn = Math.max(1, ...seatLayout.map((seat) => seatPosition(seat).column))
  const maxSeatRow = Math.max(1, ...seatLayout.map((seat) => seatPosition(seat).row))
  const seatByPosition = new Map(seatLayout.map((seat) => { const position = seatPosition(seat); return [`${position.row}:${position.column}`, seat] }))
  const seatState = (seat: SeatLayoutDraft) => seat.seatType !== 'PASSENGER' || !seat.isActive ? 'unavailable' : seat.seatNumber === selectedNumber ? 'selected' : 'available'
  const editingAssignedRoute = routeMode === 'existing' && Boolean(shuttle?.route_id) && Number(existingRouteId) === Number(shuttle?.route_id)
  const setSelectedSeatType = (seatType: SeatLayoutDraft['seatType']) => { if (!selectedSeat) return; const index = seatLayout.indexOf(selectedSeat); updateSeat(index, 'seatType', seatType) }

  const generalPanel = <section className="shuttle-edit-subpanel"><div className="shuttle-edit-panel-heading"><div><h2>General information</h2><p>Update the shuttle record and vehicle details.</p></div></div><div className="shuttle-edit-form-grid"><label><span>Shuttle code</span><input value={form.shuttleCode} disabled={Boolean(shuttle)} onChange={(event) => updateForm('shuttleCode', event.target.value.toUpperCase())} required /></label><label><span>Bus number</span><input value={form.busNumber} onChange={(event) => updateForm('busNumber', event.target.value)} required /></label><label><span>Plate number</span><input value={form.plateNumber} onChange={(event) => updateForm('plateNumber', event.target.value)} /></label><label><span>Vehicle type</span><input value={form.vehicleType} onChange={(event) => updateForm('vehicleType', event.target.value)} required /></label><label><span>Capacity</span><input type="number" min="1" value={form.capacity} onChange={(event) => updateForm('capacity', event.target.value)} required /></label><label><span>GPS device ID</span><input value={form.gpsDeviceId} onChange={(event) => updateForm('gpsDeviceId', event.target.value)} placeholder="GPS-00001" /></label></div></section>

  const seatPanel = <section className="shuttle-edit-subpanel"><div className="shuttle-edit-panel-heading"><div><h2>Seat Layout ({seatLayout.length} Seats)</h2><p>Click a seat to edit its type and status.</p></div><button type="button" className="secondary-button compact" onClick={addSeat}><Plus size={14} /> Add Seat</button></div><div className="shuttle-edit-seat-editor">{seatLayout.map((seat, index) => <div className="shuttle-edit-seat-editor-row" key={`${seat.seatNumber}-${index}`}><button type="button" onClick={() => setSelectedSeatNumber(seat.seatNumber)}>{seat.seatNumber}</button><input aria-label={`Row for seat ${seat.seatNumber}`} type="number" min="1" value={seat.row} onChange={(event) => updateSeat(index, 'row', event.target.value)} /><input aria-label={`Column for seat ${seat.seatNumber}`} type="number" min="1" max="4" value={seat.column} onChange={(event) => updateSeat(index, 'column', event.target.value)} /><select aria-label={`Type for seat ${seat.seatNumber}`} value={seat.seatType} onChange={(event) => updateSeat(index, 'seatType', event.target.value)}><option value="PASSENGER">Passenger</option><option value="DRIVER">Driver</option><option value="AISLE">Aisle</option><option value="DOOR">Door</option><option value="EMPTY_SPACE">Empty space</option></select><label><input type="checkbox" checked={seat.isActive} onChange={(event) => updateSeat(index, 'isActive', event.target.checked)} /> Active</label><button type="button" className="shuttle-edit-delete" onClick={() => removeSeat(index)} aria-label={`Delete seat ${seat.seatNumber}`}><Trash2 size={15} /></button></div>)}</div></section>


  const routeAndStopsPanel = <div className="shuttle-edit-route-layout">
    <aside className="shuttle-edit-seat-column">
      <section className="shuttle-edit-card shuttle-edit-seat-card"><div className="shuttle-edit-card-heading"><div><h2>Seat Layout ({form.capacity} Seats)</h2><p>Configure seat types and status. Click a seat to edit.</p></div></div><div className="shuttle-edit-bus"><span className="shuttle-edit-bus-end">FRONT ↑</span><div className="shuttle-edit-bus-shell"><div className="shuttle-edit-bus-cabin"><span>DRIVER</span><span>DOOR</span></div><div className="shuttle-edit-seat-grid" style={{ gridTemplateColumns: `repeat(${maxSeatColumn}, minmax(0, 1fr))` }}>{Array.from({ length: maxSeatRow }, (_, rowIndex) => rowIndex + 1).flatMap((row) => Array.from({ length: maxSeatColumn }, (_, columnIndex) => columnIndex + 1).map((column) => { const seat = seatByPosition.get(`${row}:${column}`); if (!seat) return <span className="shuttle-edit-seat empty-cell" key={`${row}-${column}`} aria-hidden="true" />; return <button type="button" key={seat.seatNumber} className={`shuttle-edit-seat ${seatState(seat)}`} onClick={() => setSelectedSeatNumber(seat.seatNumber)}>{seat.seatNumber}</button> }))}</div></div><span className="shuttle-edit-bus-end">REAR ↓</span></div></section>
      <section className="shuttle-edit-card shuttle-edit-legend-card"><h2>Seat Legend</h2><div className="shuttle-edit-legend"><span><i className="available" />Available</span><span><i className="occupied" />Occupied</span><span><i className="selected" />Selected</span><span><i className="held" />Held</span><span><i className="unavailable" />Unavailable</span></div></section>
      {selectedSeat && <section className="shuttle-edit-card shuttle-edit-selected"><div className="shuttle-edit-selected-heading"><div><span>Selected Seat</span><h2>Seat {selectedSeat.seatNumber}</h2><p>Row {selectedSeat.row} <i /> Column {selectedSeat.column}</p></div><b className={seatState(selectedSeat)}>{seatState(selectedSeat).toUpperCase()}</b></div><label>Seat type<select value={selectedSeat.seatType} onChange={(event) => setSelectedSeatType(event.target.value as SeatLayoutDraft['seatType'])}><option value="PASSENGER">PASSENGER</option><option value="DRIVER">DRIVER</option><option value="AISLE">AISLE</option><option value="DOOR">DOOR</option><option value="EMPTY_SPACE">EMPTY SPACE</option></select></label><label className="shuttle-edit-active"><input type="checkbox" checked={selectedSeat.isActive} onChange={(event) => updateSeat(seatLayout.indexOf(selectedSeat), 'isActive', event.target.checked)} /> Active</label><div className="shuttle-edit-selected-actions"><button type="button" onClick={() => { setSelectedSeatType('PASSENGER'); updateSeat(seatLayout.indexOf(selectedSeat), 'isActive', true) }}>Mark as Available</button><button type="button" onClick={() => { setSelectedSeatType('EMPTY_SPACE'); updateSeat(seatLayout.indexOf(selectedSeat), 'isActive', false) }}>Mark as Unavailable</button></div></section>}
    </aside>
    <main className="shuttle-edit-route-column">
      <section className="shuttle-edit-card shuttle-edit-route-card"><div className="shuttle-edit-card-heading shuttle-edit-route-heading"><div><h2>Route &amp; Stops</h2><p>Set the shuttle route, pickup sequence and TDK destination.</p></div><div className="shuttle-edit-route-select"><label>Route<select value={routeMode === 'new' ? '__new__' : existingRouteId} onChange={(event) => { if (event.target.value === '__new__') setRouteMode('new'); else { setRouteMode('existing'); setExistingRouteId(event.target.value) } }}><option value="">Select route</option>{routes.filter((item) => item.is_active !== 0 && item.destination_name === 'TDK').map((item) => <option key={item.id} value={item.id}>{item.route_name || item.name}</option>)}<option value="__new__">Create new route</option></select></label><button type="button" className="secondary-button compact" onClick={() => notify('Route preview is shown on the map')}><Eye size={15} /> View Route</button></div></div>{routeMode === 'new' && <div className="shuttle-edit-new-route"><label><span>Route code</span><input value={route.routeCode} onChange={(event) => setRoute({ ...route, routeCode: event.target.value.toUpperCase() })} placeholder="RT-CAL-01" required /></label><label><span>Route name</span><input value={route.routeName} onChange={(event) => setRoute({ ...route, routeName: event.target.value })} placeholder="Calamba → TDK" required /></label></div>}<div className="shuttle-edit-map-actions"><button type="button" className={mapMode === 'start' ? 'active' : ''} onClick={() => { setSearchTarget('start'); setMapMode('start') }}><MapPin size={14} /> Set start</button><button type="button" className={mapMode === 'stop' ? 'active' : ''} onClick={() => { setSearchTarget('stop'); setMapMode('stop') }}><Plus size={14} /> Add stop on map</button><div className="shuttle-edit-location-search"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Philippine location" /><button type="button" onClick={() => void searchLocations()}><Search size={14} /></button></div></div>{searchResults.length > 0 && <div className="shuttle-edit-search-results">{searchResults.map((result) => <button type="button" key={result.place_id} onClick={() => selectSearchResult(result)}>{result.display_name}</button>)}</div>}<div className="shuttle-edit-map"><RouteBuilderMap start={start} stops={sortedStops} destination={tdk} geometry={geometry} onMapClick={handleMapClick} onStartDrag={(latitude, longitude) => { setStart((current) => current ? { ...current, latitude, longitude } : current); setStopsDirty(true) }} onStopDrag={(index, latitude, longitude) => { setStops((current) => current.map((stop, itemIndex) => itemIndex === index ? { ...stop, latitude, longitude } : stop)); setStopsDirty(true) }} /></div></section>
      <section className="shuttle-edit-card shuttle-edit-stops-card">
        <div className="shuttle-edit-card-heading"><div><h2>Pickup Stops ({sortedStops.length})</h2><p>Configure and edit the pickup sequence for this shuttle.</p></div><button type="button" className="primary-button compact" onClick={() => { setSearchTarget('stop'); setMapMode('stop') }}><Plus size={15} /> Add Stop</button></div>
        <div className="shuttle-edit-reuse"><select value={selectedPickupPoint} onChange={(event) => setSelectedPickupPoint(event.target.value)}><option value="">Select saved pickup point</option>{pickupPoints.map((point) => <option key={point.id} value={point.id}>{point.pickup_name}</option>)}</select><button type="button" className="secondary-button compact" disabled={!selectedPickupPoint} onClick={addExistingPickupPoint}>Add saved point</button></div>
        {shuttle && editingAssignedRoute && stopsDirty && <label className="shuttle-edit-duplicate-route"><input type="checkbox" checked={duplicateSharedRoute} onChange={(event) => setDuplicateSharedRoute(event.target.checked)} /> Create a separate route for this shuttle when saving stop changes</label>}
        {pending && <div className="shuttle-edit-pending"><strong>{pending.name}</strong><span>{pending.latitude.toFixed(5)}, {pending.longitude.toFixed(5)}</span><button type="button" onClick={addPendingStop}>Add this stop</button><button type="button" onClick={() => setPending(null)}>Cancel</button></div>}
        <div className="shuttle-edit-stop-table"><div className="shuttle-edit-stop-head"><span>#</span><span>Stop Name</span><span>Location (edit coordinates)</span><span>Wait (min)</span><span>Actions</span></div>{sortedStops.map((stop, index) => { const stopIndex = stops.indexOf(stop); return <div className="shuttle-edit-stop-row" key={`${stop.pickupCode || stop.pickupName}-${index}`} draggable onDragStart={() => setDragIndex(stopIndex)} onDragOver={(event) => event.preventDefault()} onDrop={() => reorderStop(stopIndex)}><b>{index + 1}</b><input className="shuttle-edit-stop-name" aria-label={`Stop name ${index + 1}`} value={stop.pickupName} onChange={(event) => updateStop(stopIndex, { pickupName: event.target.value })} /><div className="shuttle-edit-stop-coordinates"><input aria-label={`Latitude for stop ${index + 1}`} type="number" step="any" value={stop.latitude} onChange={(event) => updateStop(stopIndex, { latitude: Number(event.target.value) || 0 })} /><input aria-label={`Longitude for stop ${index + 1}`} type="number" step="any" value={stop.longitude} onChange={(event) => updateStop(stopIndex, { longitude: Number(event.target.value) || 0 })} /></div><input className="shuttle-edit-stop-waiting" aria-label={`Wait time for stop ${index + 1}`} type="number" min="0" value={stop.waitingTimeMinutes} onChange={(event) => updateStop(stopIndex, { waitingTimeMinutes: Math.max(0, Number(event.target.value) || 0) })} /><span><button type="button" title="Drag this row to reorder"><Grid2X2 size={15} /></button>{index > 0 && <button type="button" className="delete" title="Remove stop" onClick={() => removeStop(stopIndex)}><Trash2 size={15} /></button>}</span></div> })}{!sortedStops.length && <div className="shuttle-edit-empty">No pickup stops yet. Click Add Stop or place one on the map.</div>}</div>
      </section>
    </main>
  </div>

  const tabContent = activeTab === 'general' ? generalPanel : activeTab === 'seats' ? seatPanel : activeTab === 'assignment' ? <section className="shuttle-edit-subpanel"><div className="shuttle-edit-panel-heading"><div><h2>Assignment</h2><p>Assign this shuttle to an incoming route.</p></div></div><label className="shuttle-edit-wide-field"><span>Assigned route</span><select value={routeMode === 'new' ? '__new__' : existingRouteId} onChange={(event) => { if (event.target.value === '__new__') setRouteMode('new'); else { setRouteMode('existing'); setExistingRouteId(event.target.value) } }}><option value="">Select route</option>{routes.map((item) => <option key={item.id} value={item.id}>{item.route_name || item.name}</option>)}</select></label></section> : activeTab === 'settings' ? <section className="shuttle-edit-subpanel"><div className="shuttle-edit-panel-heading"><div><h2>Settings</h2><p>Manage device and operational status for this shuttle.</p></div></div><div className="shuttle-edit-form-grid"><label><span>GPS device ID</span><input value={form.gpsDeviceId} onChange={(event) => updateForm('gpsDeviceId', event.target.value)} /></label><label><span>Status</span><select value={form.status} onChange={(event) => updateForm('status', event.target.value)}><option value="READY">Active / Ready</option><option value="LIVE">Live</option><option value="OFFLINE">Offline</option><option value="MAINTENANCE">Maintenance</option></select></label></div></section> : routeAndStopsPanel

  return <form className="shuttle-edit-screen" onSubmit={save}><header className="shuttle-edit-header"><button type="button" className="shuttle-edit-back" onClick={onCancel}><ArrowLeft size={19} /> Back to Shuttles</button><span className="shuttle-edit-divider" /><div className="shuttle-edit-title"><h1>{isEditing ? `Edit ${shuttle?.bus_number || shuttle?.id || 'Shuttle'}` : 'Add Shuttle'}</h1><p>{isEditing ? 'Update the shuttle record, route assignment, pickup points, and seat layout.' : 'Create the shuttle record, assign its route, and configure its seat layout.'}</p></div><div className="shuttle-edit-summary"><span className="shuttle-edit-summary-icon"><BusFront size={25} /></span><span><strong>{shuttle?.bus_number || form.busNumber || 'New Shuttle'}</strong><small>{shuttle?.vehicle_name || form.vehicleType || 'Vehicle details'} ({form.capacity} Seater)</small></span><b>{form.status === 'READY' ? 'ACTIVE' : form.status}</b></div><button type="button" className="secondary-button shuttle-edit-preview" onClick={() => notify('Preview uses the current shuttle setup')}><Eye size={16} /> Preview</button><button type="submit" className="primary-button shuttle-edit-save" disabled={saving || loadingRoute}><Save size={16} /> {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Shuttle'}</button></header><nav className="shuttle-edit-tabs">{[["general", 'General', Settings], ["route", 'Route & Stops', MapPin], ["seats", 'Seat Layout', Grid2X2], ["assignment", 'Assignment', Users], ["settings", 'Settings', Settings]].map(([value, label, Icon]) => <button type="button" key={String(value)} className={activeTab === value ? 'active' : ''} onClick={() => setActiveTab(value as typeof activeTab)}><Icon size={17} /> {String(label)}</button>)}</nav>{tabContent}<footer className="shuttle-edit-footer"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button type="submit" className="primary-button" disabled={saving || loadingRoute}><Save size={15} /> {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Shuttle'}</button></footer></form>

  /* Legacy wizard markup retained below for reference. */
  /*
  return <form className="shuttle-wizard" onSubmit={save}>
    <div className="shuttle-wizard-form">
      {seatLayoutEditor}
      <h3>{shuttle ? 'Edit incoming shuttle' : 'Add incoming shuttle'}</h3><p>Configure the bus, its Philippine starting point, pickup sequence, and automatic TDK destination.</p>
      <section className="wizard-section"><div className="wizard-section-heading"><strong>1. Shuttle information</strong><span>Saved in SHUTTLES</span></div><div className="wizard-grid"><label className="wizard-field"><span>Shuttle code</span><input value={form.shuttleCode} disabled={Boolean(shuttle)} onChange={(event) => updateForm('shuttleCode', event.target.value.toUpperCase())} placeholder="SH001" required /></label><label className="wizard-field"><span>Bus number</span><input value={form.busNumber} onChange={(event) => updateForm('busNumber', event.target.value)} placeholder="BUS 01" required /></label><label className="wizard-field"><span>Plate number</span><input value={form.plateNumber} onChange={(event) => updateForm('plateNumber', event.target.value)} placeholder="ABC-1234" /></label><label className="wizard-field"><span>Vehicle type</span><input value={form.vehicleType} onChange={(event) => updateForm('vehicleType', event.target.value)} placeholder="Coaster" required /></label><label className="wizard-field"><span>Capacity</span><input type="number" min="1" value={form.capacity} onChange={(event) => updateForm('capacity', event.target.value)} required /></label><label className="wizard-field"><span>GPS device ID</span><input value={form.gpsDeviceId} onChange={(event) => updateForm('gpsDeviceId', event.target.value)} placeholder="GPS-00001" /></label><label className="wizard-field"><span>Status</span><select value={form.status} onChange={(event) => updateForm('status', event.target.value)}><option value="READY">Active / Ready</option><option value="LIVE">Live</option><option value="OFFLINE">Offline</option><option value="MAINTENANCE">Maintenance</option></select></label></div></section>
      <section className="wizard-section"><div className="wizard-section-heading"><strong>2. Incoming route setup</strong><span>TDK is always final</span></div><div className="wizard-route-choice"><button type="button" className={routeMode === 'existing' ? 'active' : ''} onClick={() => setRouteMode('existing')}>Assign existing route</button><button type="button" className={routeMode === 'new' ? 'active' : ''} onClick={() => setRouteMode('new')}>Create new route</button></div>{routeMode === 'existing' ? <label className="wizard-field"><span>Incoming route</span><select value={existingRouteId} onChange={(event) => setExistingRouteId(event.target.value)}><option value="">Select route</option>{routes.filter((item) => item.is_active !== 0 && item.destination_name === 'TDK').map((item) => <option key={item.id} value={item.id}>{item.route_name || item.name}</option>)}</select></label> : <div className="wizard-grid"><label className="wizard-field"><span>Route code</span><input value={route.routeCode} onChange={(event) => setRoute({ ...route, routeCode: event.target.value.toUpperCase() })} placeholder="RT-CAL-01" required /></label><label className="wizard-field"><span>Route name</span><input value={route.routeName} onChange={(event) => setRoute({ ...route, routeName: event.target.value })} placeholder="Calamba → TDK" required /></label><label className="wizard-field full"><span>Description</span><input value={route.description} onChange={(event) => setRoute({ ...route, description: event.target.value })} placeholder="Incoming employee shuttle" /></label></div>}</section>
      {routeMode === 'new' && <><section className="wizard-section"><div className="wizard-section-heading"><strong>3. Starting location</strong><span>Philippines only</span></div>{routeSearch}<button type="button" className="secondary-button compact" onClick={() => { setSearchTarget('start'); setMapMode('start') }}><MapPin size={13} /> Click map to select start</button>{start && <div className="wizard-message">START: {start.name}<br />{start.latitude.toFixed(6)}, {start.longitude.toFixed(6)}</div>}{shuttle && <label className="wizard-field" style={{ marginTop: 10 }}><span><input type="checkbox" checked={duplicateSharedRoute} onChange={(event) => setDuplicateSharedRoute(event.target.checked)} /> Duplicate the assigned route before changing its stops</span></label>}</section><section className="wizard-section"><div className="wizard-section-heading"><strong>4. Route stops</strong><button type="button" className="primary-button compact" onClick={() => { setSearchTarget('stop'); setMapMode('stop') }}>+ Add stop</button></div><div className="wizard-grid"><label className="wizard-field full"><span>Reuse existing pickup point</span><select value={selectedPickupPoint} onChange={(event) => setSelectedPickupPoint(event.target.value)}><option value="">Select a saved pickup point</option>{pickupPoints.map((point) => <option key={point.id} value={point.id}>{point.pickup_name}</option>)}</select></label></div>{selectedPickupPoint && <button type="button" className="secondary-button compact" onClick={addExistingPickupPoint}>Add selected pickup point</button>}{pending && <div className="wizard-message"><label className="wizard-field"><span>Stop name</span><input value={pending.name} onChange={(event) => setPending({ ...pending, name: event.target.value })} /></label><label className="wizard-field"><span>Address</span><input value={pending.address} onChange={(event) => setPending({ ...pending, address: event.target.value })} /></label><label className="wizard-field"><span>Waiting time (minutes)</span><input type="number" min="0" value={pending.waitingTimeMinutes} onChange={(event) => setPending({ ...pending, waitingTimeMinutes: event.target.value })} /></label><div className="wizard-actions"><button type="button" className="secondary-button compact" onClick={() => setPending(null)}>Cancel</button><button type="button" className="primary-button compact" onClick={addPendingStop}>Add stop</button></div></div>}{sortedStops.map((stop, index) => <div className="builder-stop-row" key={`${stop.pickupCode || stop.pickupName}-${index}`} draggable onDragStart={() => setDragIndex(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => reorderStop(index)}><span className="builder-stop-number">{index + 1}</span><div className="builder-stop-copy"><strong>{stop.pickupName}</strong><span>{stop.latitude.toFixed(5)}, {stop.longitude.toFixed(5)} · wait {stop.waitingTimeMinutes} min</span></div><div className="builder-stop-actions"><button type="button" className="remove" onClick={() => removeStop(index)}><X size={13} /></button></div></div>)}{!sortedStops.length && <div className="wizard-message">Click “+ Add stop”, search for a Philippine location, or click the map.</div>}</section><section className="wizard-section"><div className="wizard-section-heading"><strong>5. Final destination</strong><span>Automatic and locked</span></div><div className="wizard-message">★ {tdk.name} · {tdk.latitude.toFixed(6)}, {tdk.longitude.toFixed(6)}</div></section></>}
      <div className="wizard-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button type="submit" className="primary-button" disabled={saving || loadingRoute}>{saving ? 'Saving…' : 'Save shuttle setup'}</button></div>
    </div>
    <div className="wizard-map-wrap"><div className="builder-map-help">{mapMode === 'start' ? 'Click the map to place the START marker.' : mapMode === 'stop' ? 'Click the map to place a pickup stop.' : 'Philippines map · drag START or stop markers to adjust coordinates.'}</div><RouteBuilderMap start={start} stops={sortedStops} destination={tdk} geometry={geometry} onMapClick={handleMapClick} onStartDrag={(latitude, longitude) => setStart((current) => current ? { ...current, latitude, longitude } : current)} onStopDrag={(index, latitude, longitude) => setStops((current) => current.map((stop, itemIndex) => itemIndex === index ? { ...stop, latitude, longitude } : stop))} /></div>
  </form>
  */
}
