import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, ChevronDown, Clock3, Flag, GripVertical, Layers3, LockKeyhole, MapPin, Plus, Route as RouteIcon, Ruler, Search, Save, Trash2, Users, X } from 'lucide-react'
import { api, type ApiPickupPoint, type ApiRoute, type ApiRouteDetails, type LocationSearchResult } from './api'
import RouteBuilderMap, { type BuilderLocation, type BuilderStop } from './RouteBuilderMap'

type Props = { route?: ApiRoute | null; notify: (message: string) => void; onSaved: () => void; onCancel: () => void }
const defaultTdk: BuilderLocation = { name: 'TDK', address: 'TDK final destination', latitude: 14.2724796, longitude: 121.0632645 }

export default function RouteEditor({ route: editingRoute, notify, onSaved, onCancel }: Props) {
  const [form, setForm] = useState({ routeCode: editingRoute?.route_code || '', routeName: editingRoute?.route_name || editingRoute?.name || '', description: editingRoute?.description || '' })
  const [start, setStart] = useState<BuilderLocation | null>(editingRoute?.start_latitude !== null && editingRoute?.start_latitude !== undefined && editingRoute?.start_longitude !== null && editingRoute?.start_longitude !== undefined ? { name: editingRoute.start_name || '', address: '', latitude: Number(editingRoute.start_latitude), longitude: Number(editingRoute.start_longitude) } : null)
  const [stops, setStops] = useState<BuilderStop[]>([])
  const [tdk, setTdk] = useState(defaultTdk)
  const [geometry, setGeometry] = useState<Array<[number, number]>>([])
  const [pickupPoints, setPickupPoints] = useState<ApiPickupPoint[]>([])
  const [pending, setPending] = useState<{ name: string; address: string; latitude: number; longitude: number; waitingTimeMinutes: string } | null>(null)
  const [selectedPickup, setSelectedPickup] = useState('')
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<LocationSearchResult[]>([])
  const [searchTarget, setSearchTarget] = useState<'start' | 'stop'>('start')
  const [mapMode, setMapMode] = useState<'idle' | 'start' | 'stop'>('idle')
  const [saving, setSaving] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [distanceMeters, setDistanceMeters] = useState(Number(editingRoute?.total_distance || 0))
  const [durationSeconds, setDurationSeconds] = useState(Number(editingRoute?.estimated_duration || 0) * 60)

  useEffect(() => {
    Promise.all([api.systemSettings(), api.pickupPoints()]).then(([settings, points]) => {
      setTdk({ name: settings.settings.TDK_NAME || 'TDK', address: 'TDK final destination', latitude: Number(settings.settings.TDK_LATITUDE || defaultTdk.latitude), longitude: Number(settings.settings.TDK_LONGITUDE || defaultTdk.longitude) })
      setPickupPoints(points.pickupPoints.filter((point) => point.is_active !== 0))
    }).catch(() => undefined)
    if (!editingRoute) return
    api.route(editingRoute.id).then((details: ApiRouteDetails) => {
      setStops(details.stops.map((stop) => ({ pickupCode: stop.pickup_code || undefined, pickupName: stop.pickup_name, address: stop.address || '', latitude: Number(stop.latitude), longitude: Number(stop.longitude), sequence: Number(stop.sequence), waitingTimeMinutes: Number(stop.waiting_time_minutes || 0) })))
      if (details.route.route_geometry) { try { setGeometry(typeof details.route.route_geometry === 'string' ? JSON.parse(details.route.route_geometry) : details.route.route_geometry) } catch { setGeometry([]) } }
      if (details.route.total_distance) setDistanceMeters(Number(details.route.total_distance))
      if (details.route.estimated_duration) setDurationSeconds(Number(details.route.estimated_duration) * 60)
    }).catch(() => notify('Could not load route details'))
  }, [editingRoute?.id])

  useEffect(() => {
    if (!stops.length) return
    setStops((current) => current.slice().sort((a, b) => a.sequence - b.sequence).map((stop, index) => ({ ...stop, sequence: index + 1 })))
  }, [stops.length])

  useEffect(() => {
    if (!start || !stops.length) return
    const points: Array<[number, number]> = [[start.latitude, start.longitude], ...stops.slice().sort((a, b) => a.sequence - b.sequence).map((stop) => [stop.latitude, stop.longitude] as [number, number]), [tdk.latitude, tdk.longitude]]
    const timer = window.setTimeout(() => {
      api.routeGeometry(points).then((result) => { setGeometry(result.geometry); setDistanceMeters(result.distanceMeters); setDurationSeconds(result.durationSeconds) }).catch(() => notify('OSRM is unavailable; the point sequence remains visible.'))
    }, 400)
    return () => window.clearTimeout(timer)
  }, [start, stops, tdk])

  const sortedStops = useMemo(() => stops.slice().sort((a, b) => a.sequence - b.sequence), [stops])
  const updateStop = (index: number, patch: Partial<BuilderStop>) => setStops((current) => current.map((stop, stopIndex) => stopIndex === index ? { ...stop, ...patch } : stop))
  const removeStop = (index: number) => setStops((current) => current.filter((_, stopIndex) => stopIndex !== index).map((stop, stopIndex) => ({ ...stop, sequence: stopIndex + 1 })))

  const runSearch = async () => {
    if (search.trim().length < 2) return
    try { setResults((await api.searchLocation(search.trim())).results) } catch (error) { notify(error instanceof Error ? error.message : 'Location search failed') }
  }

  const chooseResult = (result: LocationSearchResult) => {
    const location = { name: result.display_name.split(',')[0], address: result.display_name, latitude: Number(result.lat), longitude: Number(result.lon) }
    if (searchTarget === 'start') setStart(location)
    else setPending({ ...location, waitingTimeMinutes: '0' })
    setResults([]); setSearch(''); setMapMode('idle')
  }

  const mapClick = async (latitude: number, longitude: number) => {
    if (mapMode === 'idle') return
    try {
      const { result } = await api.reverseLocation(latitude, longitude)
      const location = { name: result.display_name.split(',')[0], address: result.display_name, latitude, longitude }
      if (mapMode === 'start') setStart(location)
      else setPending({ ...location, waitingTimeMinutes: '0' })
    } catch {
      if (mapMode === 'start') setStart({ name: 'Selected Philippine location', address: '', latitude, longitude })
      else setPending({ name: 'New pickup point', address: '', latitude, longitude, waitingTimeMinutes: '0' })
    }
    setMapMode('idle')
  }

  const addStop = () => {
    if (!pending?.name.trim()) return
    setStops((current) => [...current, { pickupName: pending.name.trim(), address: pending.address, latitude: pending.latitude, longitude: pending.longitude, sequence: current.length + 1, waitingTimeMinutes: Number(pending.waitingTimeMinutes) || 0 }])
    setPending(null)
  }

  const addSavedStop = () => {
    const point = pickupPoints.find((item) => String(item.id) === selectedPickup)
    if (!point) return
    setStops((current) => [...current, { pickupCode: point.pickup_code, pickupName: point.pickup_name, address: point.address || '', latitude: Number(point.latitude), longitude: Number(point.longitude), sequence: current.length + 1, waitingTimeMinutes: 0 }])
    setSelectedPickup('')
  }

  const reorder = (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) return
    setStops((current) => { const next = current.slice(); const [item] = next.splice(dragIndex, 1); next.splice(targetIndex, 0, item); return next.map((stop, index) => ({ ...stop, sequence: index + 1 })) })
    setDragIndex(null)
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.routeCode || !form.routeName || !start) return notify('Route code, name, and Philippine starting location are required.')
    setSaving(true)
    try {
      const payload = { routeCode: form.routeCode, routeName: form.routeName, name: form.routeName, description: form.description, startName: start.name, startLatitude: start.latitude, startLongitude: start.longitude, routeGeometry: geometry, totalDistance: distanceMeters, estimatedDuration: Math.round(durationSeconds / 60), stops: sortedStops }
      if (editingRoute) await api.updateRoute(editingRoute.id, payload)
      else await api.createRoute(payload)
      notify(editingRoute ? 'Route updated in database' : 'Incoming route created in database')
      onSaved()
    } catch (error) { notify(error instanceof Error ? error.message : 'Could not save route') } finally { setSaving(false) }
  }

  const distanceLabel = distanceMeters ? (distanceMeters / 1000).toFixed(1) + ' km' : '—'
  const durationLabel = durationSeconds ? Math.floor(durationSeconds / 3600) + 'h ' + Math.max(0, Math.round(durationSeconds / 60) % 60) + 'm' : '—'

  return <form className="route-editor-v2" onSubmit={save}>
    <header className="route-editor-v2-header">
      <div className="route-editor-v2-heading"><span className="route-editor-v2-eyebrow"><i /> TRACKLINE WORKSPACE</span><div className="route-editor-v2-title-row"><h1>{editingRoute ? 'Edit Route - ' + (form.routeCode || 'Route') : 'Create Route'}</h1><b><Check size={13} /> ACTIVE</b></div><p>Build the complete road route from the Philippine starting location through pickup points to the locked TDK destination.</p></div>
      <div className="route-editor-v2-header-actions"><button type="button" className="secondary-button" onClick={onCancel}><ArrowLeft size={16} /> Back to routes</button><button type="submit" className="primary-button" disabled={saving}><Save size={16} /> {saving ? 'Saving...' : 'Save route'}</button></div>
    </header>
    <div className="route-editor-v2-workspace">
      <aside className="route-editor-v2-sidebar">
        {/* <nav className="route-editor-v2-stepper"><div className="active"><b>1</b><strong>Route Details</strong><span>Basic information<br />and starting location.</span></div><div className={sortedStops.length ? 'active' : ''}><b>2</b><strong>Pickup Points</strong><span>Add and manage<br />stops.</span></div><div><b>3</b><strong>Route Review</strong><span>Check the route<br />and settings.</span></div></nav> */}
        <section className="route-editor-v2-card route-editor-v2-info"><div className="route-editor-v2-card-title"><span><RouteIcon size={18} /></span><div><h2>Route Information</h2><p>Basic details for this route.</p></div></div><div className="route-editor-v2-fields"><label>Route Code <em>*</em><input value={form.routeCode} disabled={Boolean(editingRoute)} onChange={(event) => setForm({ ...form, routeCode: event.target.value.toUpperCase() })} placeholder="RT-005" required /></label><label>Route Name <em>*</em><input value={form.routeName} onChange={(event) => setForm({ ...form, routeName: event.target.value })} placeholder="Big Shuttle Loop" required /></label><label className="full">Description<input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Main campus loop with pickup stops" /></label></div></section>
        <section className="route-editor-v2-card route-editor-v2-start"><div className="route-editor-v2-card-title route-editor-v2-card-title-between"><div className="route-editor-v2-card-title"><span><MapPin size={18} /></span><div><h2>Starting Location</h2><p>Set the Philippine starting point for this route.</p></div></div><button type="button" className="route-editor-v2-light-button" onClick={() => { setSearchTarget('start'); setMapMode('start') }}><MapPin size={14} /> Set on map</button></div><div className="route-editor-v2-search"><input value={searchTarget === 'start' ? search : ''} onChange={(event) => { setSearchTarget('start'); setSearch(event.target.value) }} placeholder="Search Philippine starting location..." /><button type="button" onClick={() => void runSearch()}><Search size={16} /></button></div>{searchTarget === 'start' && results.length > 0 && <div className="route-editor-v2-results">{results.map((result) => <button type="button" key={result.place_id} onClick={() => chooseResult(result)}>{result.display_name}</button>)}</div>}{start ? <div className="route-editor-v2-location"><MapPin size={21} /><div><strong>{start.name}</strong><span>{start.address || 'Selected Philippine location'}</span><small>{start.latitude.toFixed(6)}, {start.longitude.toFixed(6)}</small></div><button type="button" onClick={() => setStart(null)} aria-label="Clear starting location"><X size={16} /></button></div> : <button type="button" className="route-editor-v2-map-prompt" onClick={() => { setSearchTarget('start'); setMapMode('start') }}><MapPin size={16} /> Click the map to select the starting point</button>}</section>
        <section className="route-editor-v2-card route-editor-v2-pickups"><div className="route-editor-v2-card-title route-editor-v2-card-title-between"><div className="route-editor-v2-card-title"><span><MapPin size={18} /></span><div><h2>Pickup Points</h2><p>Add pickup points along the route.</p></div></div><button type="button" className="primary-button compact" onClick={() => { setSearchTarget('stop'); setMapMode('stop') }}><Plus size={14} /> Add stop</button></div><div className="route-editor-v2-search"><input value={searchTarget === 'stop' ? search : ''} onChange={(event) => { setSearchTarget('stop'); setSearch(event.target.value) }} placeholder="Search pickup point..." /><button type="button" onClick={() => void runSearch()}><Search size={16} /></button></div>{searchTarget === 'stop' && results.length > 0 && <div className="route-editor-v2-results">{results.map((result) => <button type="button" key={result.place_id} onClick={() => chooseResult(result)}>{result.display_name}</button>)}</div>}<select className="route-editor-v2-saved-select" value={selectedPickup} onChange={(event) => setSelectedPickup(event.target.value)}><option value="">Reuse saved pickup point</option>{pickupPoints.map((point) => <option key={point.id} value={point.id}>{point.pickup_name}</option>)}</select>{selectedPickup && <button type="button" className="route-editor-v2-add-saved" onClick={addSavedStop}>Add saved point</button>}{pending && <div className="route-editor-v2-pending"><input value={pending.name} onChange={(event) => setPending({ ...pending, name: event.target.value })} placeholder="Stop name" /><input type="number" min="0" value={pending.waitingTimeMinutes} onChange={(event) => setPending({ ...pending, waitingTimeMinutes: event.target.value })} placeholder="Wait min" /><button type="button" onClick={addStop}><Check size={14} /> Add</button><button type="button" onClick={() => setPending(null)}><X size={14} /></button></div>}<div className="route-editor-v2-stop-list">{sortedStops.map((stop, index) => { const stopIndex = stops.indexOf(stop); return <div className="route-editor-v2-stop" key={(stop.pickupCode || stop.pickupName) + index} draggable onDragStart={() => setDragIndex(stopIndex)} onDragOver={(event) => event.preventDefault()} onDrop={() => reorder(stopIndex)}><GripVertical size={15} className="drag-icon" /><b>{index + 1}</b><div><input value={stop.pickupName} onChange={(event) => updateStop(stopIndex, { pickupName: event.target.value })} aria-label={'Pickup point ' + (index + 1)} /><small>{stop.latitude.toFixed(5)}, {stop.longitude.toFixed(5)}</small></div><button type="button" title="Remove pickup point" onClick={() => removeStop(stopIndex)}><Trash2 size={15} /></button></div>})}{!sortedStops.length && <div className="route-editor-v2-empty">Add pickup points by searching or clicking the map.</div>}</div></section>
        <section className="route-editor-v2-card route-editor-v2-destination"><div className="route-editor-v2-card-title route-editor-v2-card-title-between"><div className="route-editor-v2-card-title"><span><Flag size={18} /></span><div><h2>Final Destination</h2><p>TDK is always the final destination.</p></div></div><small><LockKeyhole size={15} /> Locked</small></div><div className="route-editor-v2-destination-box"><strong>{tdk.name}</strong><span>{tdk.latitude.toFixed(6)}, {tdk.longitude.toFixed(6)}</span></div></section>
      </aside>
      <main className="route-editor-v2-main">
        <section className="route-editor-v2-card route-editor-v2-map-card"><header><div className="route-editor-v2-card-title"><span><MapPin size={18} /></span><div><h2>Route Map</h2><p>Click on the map to add, move or edit route stops. Drag the markers to adjust positions.</p></div></div><div className="route-editor-v2-map-tools"><button type="button" onClick={() => notify('Map view selected')}><Layers3 size={16} /> Map view <ChevronDown size={14} /></button><button type="button" onClick={() => notify('Use your browser controls to enter map fullscreen')} aria-label="Expand map">↗</button></div></header><div className="route-editor-v2-map-wrap"><RouteBuilderMap start={start} stops={sortedStops} destination={tdk} geometry={geometry} onMapClick={mapClick} onStartDrag={(latitude, longitude) => setStart((current) => current ? { ...current, latitude, longitude } : current)} onStopDrag={(index, latitude, longitude) => setStops((current) => current.map((stop, itemIndex) => itemIndex === index ? { ...stop, latitude, longitude } : stop))} /><div className="route-editor-v2-map-stats"><div><Ruler size={20} /><span>Total Distance<strong>{distanceLabel}</strong></span></div><div><Clock3 size={20} /><span>Estimated Duration<strong>{durationLabel}</strong></span></div></div><div className="route-editor-v2-map-legend"><span><i className="start" /> Start</span><span><i className="stop" /> Pickup Stop</span><span><i className="end" /> End (TDK)</span><span><i className="path" /> Route Path</span></div></div></section>
        <section className="route-editor-v2-card route-editor-v2-summary"><div className="route-editor-v2-summary-heading"><div className="route-editor-v2-card-title"><span><RouteIcon size={18} /></span><div><h2>Route Summary</h2><p>Overview of the complete route and stops.</p></div></div><button type="button" className="route-editor-v2-light-button" onClick={() => notify('Route is already ordered by pickup sequence')}><GripVertical size={14} /> Optimize Route</button></div><div className="route-editor-v2-summary-grid"><div><Users size={21} /><strong>{sortedStops.length}</strong><span>Pickup Points</span></div><div><Ruler size={21} /><strong>{distanceLabel}</strong><span>Total Distance</span></div><div><Clock3 size={21} /><strong>{durationLabel}</strong><span>Estimated Duration</span></div><div><MapPin size={21} /><strong>{form.routeName || 'Incoming Route'}</strong><span>Route Direction</span></div></div></section>
      </main>
    </div>
  </form>
}
