import { useEffect, useMemo, useState } from 'react'
import { BusFront, MapPin, Pencil, Plus, Route, Save, Search, UserRound, X } from 'lucide-react'
import { api, type ApiAssignment, type ApiDriver, type ApiPickupPoint, type ApiRoute, type ApiSchedule, type ApiShuttle } from './api'
import { PaginationControls, usePagination } from './Pagination'

type Props = { kind: 'Stops' | 'Drivers' | 'Assignments' | 'Schedules'; routes: ApiRoute[]; shuttles: ApiShuttle[]; notify: (message: string) => void; onChanged: () => void }

const initialStop = { pickupCode: '', pickupName: '', address: '', landmark: '', latitude: '14.2724796', longitude: '121.0632645', isActive: true }
const initialDriver = { employeeNumber: '', driverName: '', contactNumber: '', isActive: true }
const initialAssignment = { shuttleId: '', routeId: '', driverId: '', effectiveDate: new Date().toISOString().slice(0, 10), effectiveUntil: '', status: 'ACTIVE' }
const initialSchedule = { routeId: '', departureTime: '', expectedTdkArrival: '', daysOfWeek: '1,2,3,4,5', isActive: true }

export default function MaintenanceManager({ kind, routes, shuttles, notify, onChanged }: Props) {
  const [stops, setStops] = useState<ApiPickupPoint[]>([])
  const [drivers, setDrivers] = useState<ApiDriver[]>([])
  const [assignments, setAssignments] = useState<ApiAssignment[]>([])
  const [schedules, setSchedules] = useState<ApiSchedule[]>([])
  const [editing, setEditing] = useState<ApiPickupPoint | ApiDriver | ApiAssignment | ApiSchedule | null>(null)
  const [form, setForm] = useState<Record<string, string | boolean>>({})
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const reload = async () => {
    try {
      if (kind === 'Stops') setStops((await api.pickupPoints()).pickupPoints)
      if (kind === 'Drivers') setDrivers((await api.drivers()).drivers)
      if (kind === 'Assignments') { const [assignmentResult, driverResult] = await Promise.all([api.assignments(), api.drivers()]); setAssignments(assignmentResult.assignments); setDrivers(driverResult.drivers) }
      if (kind === 'Schedules') setSchedules((await api.schedules()).schedules)
    } catch (error) { notify(error instanceof Error ? error.message : `Could not load ${kind.toLowerCase()}.`) }
  }
  useEffect(() => { setEditing(null); setForm({}); setSearch(''); setStatusFilter('ALL'); reload() }, [kind])

  const openNew = () => {
    setEditing(null)
    setForm(kind === 'Stops' ? { ...initialStop } : kind === 'Drivers' ? { ...initialDriver } : kind === 'Assignments' ? { ...initialAssignment, shuttleId: shuttles[0]?.id || '', routeId: routes[0]?.id ? String(routes[0].id) : '' } : { ...initialSchedule, routeId: routes[0]?.id ? String(routes[0].id) : '' })
  }
  const openEdit = (item: ApiPickupPoint | ApiDriver | ApiAssignment | ApiSchedule) => {
    setEditing(item)
    if (kind === 'Stops') { const value = item as ApiPickupPoint; setForm({ pickupCode: value.pickup_code, pickupName: value.pickup_name, address: value.address || '', landmark: value.landmark || '', latitude: String(value.latitude), longitude: String(value.longitude), isActive: value.is_active !== 0 }) }
    if (kind === 'Drivers') { const value = item as ApiDriver; setForm({ employeeNumber: value.employee_number, driverName: value.driver_name, contactNumber: value.contact_number || '', isActive: value.is_active !== 0 }) }
    if (kind === 'Assignments') { const value = item as ApiAssignment; setForm({ shuttleId: value.shuttle_id, routeId: String(value.route_id), driverId: value.driver_id ? String(value.driver_id) : '', effectiveDate: value.effective_date, effectiveUntil: value.effective_until || '', status: value.status }) }
    if (kind === 'Schedules') { const value = item as ApiSchedule; setForm({ routeId: String(value.route_id), departureTime: value.departure_time.slice(0, 5), expectedTdkArrival: value.expected_tdk_arrival?.slice(0, 5) || '', daysOfWeek: value.days_of_week, isActive: value.is_active !== 0 }) }
  }
  const value = (key: string) => String(form[key] ?? '')
  const setValue = (key: string, next: string | boolean) => setForm((current) => ({ ...current, [key]: next }))
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true)
    try {
      if (kind === 'Stops') { const payload = { pickupCode: value('pickupCode'), pickupName: value('pickupName'), address: value('address'), landmark: value('landmark'), latitude: Number(value('latitude')), longitude: Number(value('longitude')), isActive: Boolean(form.isActive) }; editing ? await api.updatePickupPoint((editing as ApiPickupPoint).id, payload) : await api.createPickupPoint(payload) }
      if (kind === 'Drivers') { const payload = { employeeNumber: value('employeeNumber'), driverName: value('driverName'), contactNumber: value('contactNumber'), isActive: Boolean(form.isActive) }; editing ? await api.updateDriver((editing as ApiDriver).id, payload) : await api.createDriver(payload) }
      if (kind === 'Assignments') { const payload = { shuttleId: value('shuttleId'), routeId: Number(value('routeId')), driverId: value('driverId') ? Number(value('driverId')) : null, effectiveDate: value('effectiveDate'), effectiveUntil: value('effectiveUntil') || null, status: value('status') }; editing ? await api.updateAssignment((editing as ApiAssignment).id, payload) : await api.createAssignment(payload) }
      if (kind === 'Schedules') { const payload = { routeId: Number(value('routeId')), departureTime: value('departureTime'), expectedTdkArrival: value('expectedTdkArrival') || null, daysOfWeek: value('daysOfWeek'), isActive: Boolean(form.isActive) }; editing ? await api.updateSchedule((editing as ApiSchedule).id, payload) : await api.createSchedule(payload) }
      notify(`${kind} saved in database`); setEditing(null); setForm({}); onChanged(); await reload()
    } catch (error) { notify(error instanceof Error ? error.message : `Could not save ${kind.toLowerCase()}.`) } finally { setSaving(false) }
  }
  const remove = async (id: number) => {
    const label = kind === 'Stops' ? 'pickup point' : kind.slice(0, -1).toLowerCase()
    if (!window.confirm(`Permanently delete this ${label}? This cannot be undone.`)) return
    try {
      if (kind === 'Stops') await api.permanentlyDeletePickupPoint(id)
      if (kind === 'Drivers') await api.permanentlyDeleteDriver(id)
      if (kind === 'Schedules') await api.permanentlyDeleteSchedule(id)
      if (kind === 'Assignments') await api.permanentlyDeleteAssignment(id)
      notify(`${kind} permanently deleted`); onChanged(); await reload()
    } catch (error) { notify(error instanceof Error ? error.message : 'Could not permanently delete record.') }
  }

  const title = kind === 'Stops' ? 'Pickup points' : kind
  const items = kind === 'Stops' ? stops : kind === 'Drivers' ? drivers : kind === 'Assignments' ? assignments : schedules
  const filteredItems = useMemo(() => items.filter((item) => {
    const query = search.trim().toLowerCase()
    const matchesSearch = !query || JSON.stringify(item).toLowerCase().includes(query)
    const record = item as { is_active?: number; status?: string }
    const currentStatus = kind === 'Assignments' ? record.status : record.is_active ? 'ACTIVE' : 'INACTIVE'
    return matchesSearch && (statusFilter === 'ALL' || currentStatus === statusFilter)
  }), [items, kind, search, statusFilter])
  const pagination = usePagination<ApiPickupPoint | ApiDriver | ApiAssignment | ApiSchedule>(filteredItems as Array<ApiPickupPoint | ApiDriver | ApiAssignment | ApiSchedule>, 8)
  useEffect(() => { pagination.setPage(0) }, [kind])
  const visibleStops = pagination.visibleItems as ApiPickupPoint[]
  const visibleDrivers = pagination.visibleItems as ApiDriver[]
  const visibleAssignments = pagination.visibleItems as ApiAssignment[]
  const visibleSchedules = pagination.visibleItems as ApiSchedule[]
  return <div className="crud-page maintenance-page"><div className="crud-toolbar"><div><h3>{title} in database</h3><span>{search || statusFilter !== 'ALL' ? `${filteredItems.length} matching records` : `${items.length} records`} · every change persists in MariaDB</span></div><div className="crud-filters"><label className="crud-search"><Search size={15} /><input value={search} onChange={(event) => { setSearch(event.target.value); pagination.setPage(0) }} placeholder={`Search ${kind.toLowerCase()}...`} aria-label={`Search ${kind}`} /></label><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); pagination.setPage(0) }} aria-label={`Filter ${kind} by status`}><option value="ALL">All status</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></div><button className="primary-button compact" onClick={openNew}><Plus size={14} /> Add {kind === 'Stops' ? 'pickup point' : kind.slice(0, -1).toLowerCase()}</button></div>
    {Object.keys(form).length > 0 && <form className="crud-form" onSubmit={save}><div className="crud-form-heading"><strong>{editing ? `Edit ${kind === 'Stops' ? 'pickup point' : kind.slice(0, -1).toLowerCase()}` : `New ${kind === 'Stops' ? 'pickup point' : kind.slice(0, -1).toLowerCase()}`}</strong><button type="button" className="close-small" onClick={() => { setEditing(null); setForm({}) }}><X size={14} /></button></div>{kind === 'Stops' && <div className="crud-form-grid"><label>Pickup code<input value={value('pickupCode')} onChange={(event) => setValue('pickupCode', event.target.value.toUpperCase())} placeholder="PP-MAYAPA" /></label><label>Pickup name<input value={value('pickupName')} onChange={(event) => setValue('pickupName', event.target.value)} required /></label><label>Address<input value={value('address')} onChange={(event) => setValue('address', event.target.value)} /></label><label>Landmark<input value={value('landmark')} onChange={(event) => setValue('landmark', event.target.value)} /></label><label>Latitude<input type="number" step="any" value={value('latitude')} onChange={(event) => setValue('latitude', event.target.value)} required /></label><label>Longitude<input type="number" step="any" value={value('longitude')} onChange={(event) => setValue('longitude', event.target.value)} required /></label></div>}{kind === 'Drivers' && <div className="crud-form-grid"><label>Employee number<input value={value('employeeNumber')} onChange={(event) => setValue('employeeNumber', event.target.value)} required /></label><label>Driver name<input value={value('driverName')} onChange={(event) => setValue('driverName', event.target.value)} required /></label><label>Contact number<input value={value('contactNumber')} onChange={(event) => setValue('contactNumber', event.target.value)} /></label></div>}{kind === 'Assignments' && <div className="crud-form-grid"><label>Shuttle<select value={value('shuttleId')} onChange={(event) => setValue('shuttleId', event.target.value)} required><option value="">Select shuttle</option>{shuttles.map((shuttle) => <option key={shuttle.id} value={shuttle.id}>{shuttle.bus_number || shuttle.id}</option>)}</select></label><label>Route<select value={value('routeId')} onChange={(event) => setValue('routeId', event.target.value)} required><option value="">Select route</option>{routes.filter((route) => route.is_active !== 0).map((route) => <option key={route.id} value={route.id}>{route.route_name || route.name}</option>)}</select></label><label>Driver<select value={value('driverId')} onChange={(event) => setValue('driverId', event.target.value)}><option value="">No driver</option>{drivers.filter((driver) => driver.is_active !== 0).map((driver) => <option key={driver.id} value={driver.id}>{driver.driver_name}</option>)}</select></label><label>Effective date<input type="date" value={value('effectiveDate')} onChange={(event) => setValue('effectiveDate', event.target.value)} required /></label><label>Effective until<input type="date" value={value('effectiveUntil')} onChange={(event) => setValue('effectiveUntil', event.target.value)} /></label><label>Status<select value={value('status')} onChange={(event) => setValue('status', event.target.value)}><option>ACTIVE</option><option>INACTIVE</option></select></label></div>}{kind === 'Schedules' && <div className="crud-form-grid"><label>Route<select value={value('routeId')} onChange={(event) => setValue('routeId', event.target.value)} required><option value="">Select route</option>{routes.filter((route) => route.is_active !== 0).map((route) => <option key={route.id} value={route.id}>{route.route_name || route.name}</option>)}</select></label><label>Departure time<input type="time" value={value('departureTime')} onChange={(event) => setValue('departureTime', event.target.value)} required /></label><label>Expected TDK arrival<input type="time" value={value('expectedTdkArrival')} onChange={(event) => setValue('expectedTdkArrival', event.target.value)} /></label><label>Days of week<input value={value('daysOfWeek')} onChange={(event) => setValue('daysOfWeek', event.target.value)} placeholder="1,2,3,4,5" /></label></div>}<label className="maintenance-checkbox"><input type="checkbox" checked={Boolean(form.isActive)} onChange={(event) => setValue('isActive', event.target.checked)} /> Active</label><div className="crud-form-actions"><button type="button" className="secondary-button compact" onClick={() => { setEditing(null); setForm({}) }}>Cancel</button><button type="submit" className="primary-button compact" disabled={saving}><Save size={13} />{saving ? 'Saving…' : 'Save'}</button></div></form>}
    <div className="crud-list">{kind === 'Stops' && visibleStops.map((item) => <div className="crud-row" key={item.id}><div className="resource-icon blue"><MapPin size={17} /></div><div className="crud-main"><strong>{item.pickup_name}</strong><span>{item.pickup_code} · {Number(item.latitude).toFixed(5)}, {Number(item.longitude).toFixed(5)}</span></div><span className={`setting-status ${item.is_active ? 'live' : ''}`}><i />{item.is_active ? 'ACTIVE' : 'INACTIVE'}</span><button className="crud-action" onClick={() => openEdit(item)}><Pencil size={13} /></button><button className="crud-action danger-text" onClick={() => remove(item.id)}>Delete permanently</button></div>)}{kind === 'Drivers' && visibleDrivers.map((item) => <div className="crud-row" key={item.id}><div className="resource-icon green"><UserRound size={17} /></div><div className="crud-main"><strong>{item.driver_name}</strong><span>{item.employee_number} · {item.contact_number || 'No contact number'}</span></div><span className={`setting-status ${item.is_active ? 'live' : ''}`}><i />{item.is_active ? 'ACTIVE' : 'INACTIVE'}</span><button className="crud-action" onClick={() => openEdit(item)}><Pencil size={13} /></button><button className="crud-action danger-text" onClick={() => remove(item.id)}>Delete permanently</button></div>)}{kind === 'Assignments' && visibleAssignments.map((item) => <div className="crud-row" key={item.id}><div className="resource-icon yellow"><BusFront size={17} /></div><div className="crud-main"><strong>{item.bus_number || item.shuttle_id} · {item.route_name}</strong><span>{item.driver_name || 'No driver'} · effective {String(item.effective_date).slice(0, 10)}</span></div><span className={`setting-status ${item.status === 'ACTIVE' ? 'live' : ''}`}><i />{item.status}</span><button className="crud-action" onClick={() => openEdit(item)}><Pencil size={13} /></button><button className="crud-action danger-text" onClick={() => remove(item.id)}>Delete permanently</button></div>)}{kind === 'Schedules' && visibleSchedules.map((item) => <div className="crud-row" key={item.id}><div className="resource-icon purple"><Route size={17} /></div><div className="crud-main"><strong>{item.route_name}</strong><span>{item.departure_time.slice(0, 5)} → TDK {item.expected_tdk_arrival ? `· ${item.expected_tdk_arrival.slice(0, 5)}` : ''} · days {item.days_of_week}</span></div><span className={`setting-status ${item.is_active ? 'live' : ''}`}><i />{item.is_active ? 'ACTIVE' : 'INACTIVE'}</span><button className="crud-action" onClick={() => openEdit(item)}><Pencil size={13} /></button><button className="crud-action danger-text" onClick={() => remove(item.id)}>Delete permanently</button></div>)}</div>
    <PaginationControls {...pagination} setPage={pagination.setPage} />
  </div>
}
