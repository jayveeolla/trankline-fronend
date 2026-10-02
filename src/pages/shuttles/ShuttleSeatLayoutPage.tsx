import { useEffect, useMemo, useState, type SetStateAction } from 'react'
import { ArrowLeft, BusFront, Check, ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { api, type ApiSeat, type ApiShuttle } from '../../api'
import ModulePageFrame from '../shared/ModulePageFrame'

type SeatDraft = Pick<ApiSeat, 'seat_number' | 'row_position' | 'column_position' | 'seat_type' | 'is_active'> & { state?: ApiSeat['state'] }
const seatTypes = ['PASSENGER', 'DRIVER', 'AISLE', 'DOOR', 'EMPTY_SPACE'] as const
const pageSize = 16
const layoutColumnCount = (capacity: number) => capacity <= 24 ? 3 : 4

function defaultSeats(capacity: number): SeatDraft[] {
  const columns = layoutColumnCount(capacity)
  return Array.from({ length: capacity }, (_, index) => ({ seat_number: String(index + 1).padStart(2, '0'), row_position: Math.floor(index / columns) + 1, column_position: (index % columns) + 1, seat_type: 'PASSENGER', is_active: 1, state: 'AVAILABLE' }))
}

function statusOf(seat: SeatDraft) {
  if (seat.seat_type !== 'PASSENGER' || !seat.is_active) return 'UNAVAILABLE'
  if (seat.state === 'OCCUPIED') return 'OCCUPIED'
  if (seat.state === 'HELD' || seat.state === 'HELD_BY_ME') return 'HELD'
  return 'AVAILABLE'
}

export default function ShuttleSeatLayoutPage({ shuttleId, onBack }: { shuttleId: string; onBack?: () => void }) {
  const [capacity, setCapacity] = useState(0)
  const [shuttle, setShuttle] = useState<ApiShuttle | null>(null)
  const [seats, setSeatState] = useState<SeatDraft[]>([])
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    Promise.all([api.shuttleSeats(shuttleId), api.shuttles().catch(() => ({ shuttles: [] as ApiShuttle[] }))]).then(([layout, fleet]) => {
      if (!active) return
      const nextCapacity = Number(layout.shuttle.capacity) || layout.seats.filter((seat) => seat.seat_type === 'PASSENGER' && seat.is_active).length
      setCapacity(nextCapacity)
      setShuttle(fleet.shuttles.find((item) => item.id === shuttleId) || null)
      const loadedSeats = layout.seats.map(({ seat_number, row_position, column_position, seat_type, is_active, state }) => ({ seat_number, row_position, column_position, seat_type: seat_type as SeatDraft['seat_type'], is_active, state }))
      setSeatState(loadedSeats.length ? loadedSeats : defaultSeats(nextCapacity))
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load this seat layout.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [shuttleId])

  const passengerCount = seats.filter((seat) => seat.seat_type === 'PASSENGER' && seat.is_active).length
  const filteredSeats = useMemo(() => seats.filter((seat) => seat.seat_number.toLowerCase().includes(search.trim().toLowerCase())), [search, seats])
  const pageCount = Math.max(1, Math.ceil(filteredSeats.length / pageSize))
  const visibleSeats = filteredSeats.slice((page - 1) * pageSize, page * pageSize)
  const maxRow = Math.max(1, ...seats.map((seat) => Number(seat.row_position) || 1))
  const maxColumn = Math.max(1, ...seats.map((seat) => Number(seat.column_position) || 1))
  const rows = Array.from({ length: maxRow }, (_, index) => index + 1)
  const selected = seats.find((seat) => seat.seat_number === selectedSeat)
  const updateSeat = (seatNumber: string, patch: Partial<SeatDraft>) => setSeats((current) => current.map((seat) => seat.seat_number === seatNumber ? { ...seat, ...patch } : seat))
  const renumberSeats = (items: SeatDraft[]) => {
    const columns = Math.max(1, maxColumn, ...items.map((seat) => Number(seat.column_position) || 1))
    return items.map((seat, index) => ({ ...seat, seat_number: String(index + 1).padStart(2, '0'), row_position: Math.floor(index / columns) + 1, column_position: index % columns + 1 }))
  }
  const setSeats = (updater: SetStateAction<SeatDraft[]>) => setSeatState((current) => {
    const next = typeof updater === 'function' ? updater(current) : updater
    return next.length < current.length ? renumberSeats(next) : next
  })
  const addSeat = () => { const index = seats.length; const columns = Math.max(1, maxColumn); const next = { seat_number: String(index + 1).padStart(2, '0'), row_position: Math.floor(index / columns) + 1, column_position: index % columns + 1, seat_type: 'PASSENGER' as const, is_active: 1, state: 'AVAILABLE' as const }; setSeats((current) => [...current, next]); setSelectedSeat(next.seat_number); setPage(Math.ceil((filteredSeats.length + 1) / pageSize)) }
  const removeSeat = (seatNumber: string) => { setSeats((current) => renumberSeats(current.filter((seat) => seat.seat_number !== seatNumber))); setSelectedSeat(null) }
  const save = async () => {
    setError(''); setMessage('')
    if (passengerCount !== capacity) return setError(`The layout needs exactly ${capacity} active passenger seats. Current: ${passengerCount}.`)
    setSaving(true)
    try { await api.updateShuttleSeats(shuttleId, seats); setMessage('Seat layout saved successfully.') } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save the seat layout.') } finally { setSaving(false) }
  }

  return <ModulePageFrame title="" description="">
    <div className="seat-layout-screen">
      <header className="seat-layout-header"><button className="seat-layout-back" type="button" onClick={onBack}><ArrowLeft size={19} /> Back to Shuttles</button><div className="seat-layout-header-divider" /><div className="seat-layout-title"><h1>Seat Layout - {shuttleId}</h1><p>Configure seats, assign types and status for this shuttle.</p></div><div className="seat-layout-shuttle-summary"><div className="seat-layout-shuttle-icon"><BusFront size={24} /></div><div><strong>{shuttle?.bus_number || shuttleId}</strong><span>{shuttle?.vehicle_name || 'Shuttle vehicle'} ({capacity || '—'} Seater)</span></div><div className="seat-layout-active"><b>{shuttle?.status || 'ACTIVE'}</b><span>Plate No. {shuttle?.plate_number || '—'}</span></div></div></header>
      {message && <div className="module-success">{message}</div>}{error && <div className="module-error">{error}</div>}
      {loading ? <div className="module-empty-state"><strong>Loading seat layout…</strong></div> : <div className="seat-layout-workspace">
        <aside className="seat-layout-left"><div className="seat-layout-bus-card"><span className="seat-layout-end front">FRONT</span><div className="seat-layout-bus-shell"><div className="seat-layout-driver">DRIVER</div><div className="seat-layout-door">DOOR</div><div className="seat-layout-bus-seats" style={{ gridTemplateColumns: `repeat(${maxColumn}, minmax(0, 1fr))` }}>{rows.flatMap((row) => Array.from({ length: maxColumn }, (_, index) => index + 1).map((column) => { const seat = seats.find((item) => Number(item.row_position) === row && Number(item.column_position) === column); if (!seat) return <div className="seat-layout-bus-seat empty" key={`${row}-${column}`} />; const status = statusOf(seat); return <button type="button" className={`seat-layout-bus-seat ${status.toLowerCase()} ${selectedSeat === seat.seat_number ? 'selected' : ''}`} key={`${row}-${column}`} onClick={() => setSelectedSeat(seat.seat_number)}>{seat.seat_number}</button> }))}</div></div><span className="seat-layout-end rear">REAR</span></div>{selected && <div className="seat-layout-selected"><div><span>Selected Seat</span><strong>Seat {selected.seat_number}</strong><p>Row: {selected.row_position} <i /> Column: {selected.column_position} <i /> Type: {selected.seat_type}</p></div><b>SELECTED</b></div>}</aside>
        <main className="seat-layout-right"><section className="seat-layout-legend-card"><h2>Seat Legend</h2><div className="seat-layout-legend"><Legend color="available" title="Available" description="Can be selected" /><Legend color="occupied" title="Occupied" description="Already taken" /><Legend color="selected" title="Selected" description="Currently selected" /><Legend color="held" title="Held" description="Temporarily reserved" /><Legend color="unavailable" title="Unavailable" description="Driver, door, aisle or disabled seat" /></div></section><section className="seat-layout-config-card"><div className="seat-layout-config-heading"><div><h2>Seat Configuration ({seats.length})</h2><p>Manage seat properties, type and status.</p></div><div className="seat-layout-actions"><label className="seat-search"><Search size={16} /><input placeholder="Search seat number..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} /></label><button className="primary-button" type="button" onClick={addSeat}><Plus size={15} /> Add Seat</button><button className="primary-button compact" type="button" disabled={saving} onClick={() => void save()}><Check size={14} /> {saving ? 'Saving' : 'Save'}</button></div></div>{seats.length ? <div className="seat-table-wrap"><table className="seat-table"><thead><tr><th><input type="checkbox" aria-label="Select all seats" /></th><th>Seat No.</th><th>Row</th><th>Column</th><th>Seat Type</th><th>Status</th><th>Actions</th></tr></thead><tbody>{visibleSeats.map((seat) => { const status = statusOf(seat); return <tr className={selectedSeat === seat.seat_number ? 'selected-row' : ''} key={seat.seat_number}><td><input type="checkbox" aria-label={`Select seat ${seat.seat_number}`} /></td><td><button className="seat-number-button" type="button" onClick={() => setSelectedSeat(seat.seat_number)}>{seat.seat_number}</button></td><td><input value={seat.row_position} type="number" min="1" onChange={(event) => updateSeat(seat.seat_number, { row_position: Math.max(1, Number(event.target.value) || 1) })} /></td><td><input value={seat.column_position} type="number" min="1" max="4" onChange={(event) => updateSeat(seat.seat_number, { column_position: Math.min(4, Math.max(1, Number(event.target.value) || 1)) })} /></td><td><select value={seat.seat_type} onChange={(event) => updateSeat(seat.seat_number, { seat_type: event.target.value as SeatDraft['seat_type'] })}>{seatTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></td><td><span className={`seat-status ${status.toLowerCase()}`}>{status[0] + status.slice(1).toLowerCase()}</span></td><td><label className="seat-active"><input type="checkbox" checked={Boolean(seat.is_active)} onChange={(event) => updateSeat(seat.seat_number, { is_active: event.target.checked ? 1 : 0 })} /> Active</label><button className="table-icon-button" type="button" title="Select seat" onClick={() => setSelectedSeat(seat.seat_number)}><Pencil size={15} /></button><button className="table-icon-button delete" type="button" title="Remove seat" onClick={() => setSeats((current) => current.filter((item) => item.seat_number !== seat.seat_number))}><Trash2 size={15} /></button></td></tr> })}</tbody></table></div> : <div className="module-empty-state"><strong>No seats found</strong><span>Add a seat or change the search.</span></div>}<footer className="seat-pagination"><span>Showing {visibleSeats.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filteredSeats.length)} of {filteredSeats.length} seats</span><div><button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={15} /></button><b>{page}</b><span>of {pageCount}</span><button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}><ChevronRight size={15} /></button></div></footer></section></main>
      </div>}
    </div>
  </ModulePageFrame>
}

function Legend({ color, title, description }: { color: string; title: string; description: string }) { return <div className="seat-legend-item"><i className={`legend-seat-icon ${color}`} /><div><strong>{title}</strong><span>{description}</span></div></div> }
