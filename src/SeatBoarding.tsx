import { useEffect, useRef, useState } from 'react'
import { BusFront, Check, Clock3, LockKeyhole, PenLine, Users, X } from 'lucide-react'
import { api, type ApiBoardingState, type ApiPassenger, type SessionUser } from './api'
import { getRealtimeSocket } from './realtime'

type Props = { shuttleId: string; user: SessionUser; userLocation: { latitude: number; longitude: number; accuracy: number } | null; notify: (message: string) => void }

function formatBoardedAt(value?: string | null) {
  return value ? new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—'
}

function SignaturePad({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const hasInk = useRef(false)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = Math.max(1, window.devicePixelRatio || 1)
    const rect = canvas.getBoundingClientRect()
    canvas.width = Math.max(1, Math.round(rect.width * ratio))
    canvas.height = Math.max(1, Math.round(rect.height * ratio))
    const context = canvas.getContext('2d')
    if (!context) return
    context.scale(ratio, ratio)
    context.lineWidth = 2
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.strokeStyle = '#216da8'
    if (value) { const image = new Image(); image.onload = () => context.drawImage(image, 0, 0, rect.width, rect.height); image.src = value }
  }, [value])
  const point = (event: React.PointerEvent<HTMLCanvasElement>) => { const rect = event.currentTarget.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top } }
  const start = (event: React.PointerEvent<HTMLCanvasElement>) => { event.currentTarget.setPointerCapture(event.pointerId); drawing.current = true; const p = point(event); const context = event.currentTarget.getContext('2d'); if (context) { context.beginPath(); context.moveTo(p.x, p.y) } }
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => { if (!drawing.current) return; const p = point(event); const context = event.currentTarget.getContext('2d'); if (context) { context.lineTo(p.x, p.y); context.stroke(); hasInk.current = true } }
  const end = (event: React.PointerEvent<HTMLCanvasElement>) => { if (!drawing.current) return; drawing.current = false; onChange(event.currentTarget.toDataURL('image/png')) }
  const clear = () => { const canvas = canvasRef.current; const context = canvas?.getContext('2d'); if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height); hasInk.current = false; onChange('') }
  return <div className="signature-field"><div className="signature-canvas-wrap"><canvas ref={canvasRef} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} aria-label="Signature pad" /><span>{hasInk.current || value ? '' : 'Sign here'}</span></div><button type="button" className="secondary-button compact" onClick={clear}>Clear signature</button></div>
}

function LegacySeatMap({ state, onSelect }: { state: ApiBoardingState; onSelect: (seatId: number) => void }) {
  const rows = Array.from(new Set(state.seats.map((seat) => Number(seat.row_position)))).sort((a, b) => a - b)
  return <div className="seat-map-shell"><div className="seat-map-front"><span>FRONT</span><strong><BusFront size={14} /> DRIVER</strong><span>DOOR</span></div><div className="seat-map-body">{rows.map((row) => <div className="seat-row" key={row}>{state.seats.filter((seat) => Number(seat.row_position) === row).sort((a, b) => Number(a.column_position) - Number(b.column_position)).map((seat) => <button type="button" key={seat.id} className={`seat ${seat.state ? seat.state.toLowerCase().replace(/_/g, '-') : 'disabled'} ${seat.seat_type !== 'PASSENGER' ? 'non-passenger' : ''}`} disabled={seat.state !== 'AVAILABLE'} onClick={() => onSelect(Number(seat.id))} title={`${seat.seat_number} · ${seat.state}`}><span>{seat.seat_number}</span>{seat.state === 'OCCUPIED' && <Check size={11} />}</button>)}</div>)}</div><div className="seat-legend"><span><i className="seat-dot available" />Available</span><span><i className="seat-dot occupied" />Occupied</span><span><i className="seat-dot selected" />Selected by me</span><span><i className="seat-dot disabled" />Unavailable</span></div></div>
}

function SeatMap({ state, onSelect }: { state: ApiBoardingState; onSelect: (seatId: number) => void }) {
  const rows = Array.from(new Set(state.seats.map((seat) => Number(seat.row_position)))).sort((a, b) => a - b)
  return <div className="seat-map-shell redesigned-seat-map"><div className="seat-map-summary"><div><Users size={15} /><strong>{state.occupied} / {state.capacity}</strong><span>Passengers</span></div><div><BusFront size={15} /><strong>{state.available}</strong><span>Available seats</span></div><div className={state.eligibility.open ? 'open' : ''}><span className="summary-dot" /><strong>{state.eligibility.open ? 'OPEN' : 'CLOSED'}</strong><span>{state.eligibility.open ? 'Boarding open' : 'Boarding unavailable'}</span></div></div><div className="vehicle-map"><div className="vehicle-windshield" /><div className="vehicle-front-zone"><div className="vehicle-driver"><BusFront size={13} /><span>DRIVER</span></div><div className="vehicle-door"><span>DOOR</span><small>EXIT</small></div></div><div className="vehicle-aisle-label">AISLE</div><div className="vehicle-seat-rows">{rows.map((row) => <div className="vehicle-seat-row" key={row}>{state.seats.filter((seat) => Number(seat.row_position) === row).sort((a, b) => Number(a.column_position) - Number(b.column_position)).map((seat) => { const unavailable = seat.state === 'DISABLED' || seat.seat_type !== 'PASSENGER'; const occupied = seat.state === 'OCCUPIED'; const label = unavailable ? `${seat.seat_number} unavailable` : occupied ? `${seat.seat_number} occupied` : `${seat.seat_number} available`; return <button type="button" key={seat.id} className={`vehicle-seat ${seat.state ? seat.state.toLowerCase().replace(/_/g, '-') : 'disabled'} ${unavailable ? 'non-passenger' : ''}`} disabled={seat.state !== 'AVAILABLE'} onClick={() => onSelect(Number(seat.id))} title={label} aria-label={label}><span className="seat-backrest" /><strong>{seat.seat_number}</strong>{occupied && <Check size={11} />}</button> })}</div>)}</div><div className="vehicle-rear-zone">REAR</div></div><div className="seat-legend"><span><i className="seat-dot available" />Available</span><span><i className="seat-dot occupied" />Occupied</span><span><i className="seat-dot selected" />Selected</span><span><i className="seat-dot held" />Held</span><span><i className="seat-dot disabled" />Unavailable</span></div></div>
}

function UnusedPassengerManifest({ passengers }: { passengers: ApiPassenger[] }) {
  const [rows, setRows] = useState(passengers)
  const [busyId, setBusyId] = useState<number | null>(null)
  useEffect(() => setRows(passengers), [passengers])
  const hide = async (passenger: ApiPassenger) => {
    setBusyId(passenger.id)
    try { await api.hideTestPassenger(passenger.trip_id, passenger.id); setRows((current) => current.filter((item) => item.id !== passenger.id)); window.dispatchEvent(new Event('refresh-seat-boarding')) } catch { /* parent refresh will show the record if the action failed */ } finally { setBusyId(null) }
  }
  const remove = async (passenger: ApiPassenger) => {
    if (!window.confirm(`Remove test passenger ${passenger.employee_name} permanently?`)) return
    setBusyId(passenger.id)
    try { await api.removeTestPassenger(passenger.trip_id, passenger.id); setRows((current) => current.filter((item) => item.id !== passenger.id)); window.dispatchEvent(new Event('refresh-seat-boarding')) } catch { /* parent refresh will show the record if the action failed */ } finally { setBusyId(null) }
  }
  return <div className="passenger-manifest">{rows.length ? rows.map((passenger) => <div className="passenger-manifest-row" key={passenger.id}><strong>Seat {passenger.seat_number}</strong><span>{passenger.employee_number} · {passenger.employee_name}{passenger.is_test ? ' · TEST' : ''}</span><time>{formatBoardedAt(passenger.boarded_at)}{passenger.boarding_stop_name ? ` · ${passenger.boarding_stop_name}` : ''}</time>{passenger.is_test ? <div className="test-passenger-actions"><button type="button" className="secondary-button compact" disabled={busyId === passenger.id} onClick={() => void hide(passenger)}>Hide</button><button type="button" className="secondary-button compact danger" disabled={busyId === passenger.id} onClick={() => void remove(passenger)}>Remove</button>{passenger.signature_data && <img src={passenger.signature_data} alt="Test passenger signature" />}</div> : null}</div>) : <div className="seat-empty">No passengers have boarded this trip.</div>}</div>
}

type ManifestSeat = { id: number; seat_number: string; row_position: number; column_position: number; seat_type: string; is_active: number }

function PassengerManifest({ passengers, readOnly = false, testPreview = false }: { passengers: ApiPassenger[]; readOnly?: boolean; testPreview?: boolean }) {
  const [view, setView] = useState<'list' | 'bus'>('list')
  const [seats, setSeats] = useState<ManifestSeat[]>([])
  const [rows, setRows] = useState(passengers)
  const [busyId, setBusyId] = useState<number | null>(null)
  useEffect(() => setRows(passengers), [passengers])
  useEffect(() => {
    const shuttleId = rows[0]?.shuttle_id
    if (!shuttleId) { setSeats(Array.from({ length: 32 }, (_, index) => ({ id: index, seat_number: String(index + 1).padStart(2, '0'), row_position: Math.floor(index / 4) + 1, column_position: index % 4 + 1, seat_type: 'PASSENGER', is_active: 1 }))); return }
    api.shuttleSeats(shuttleId).then((result) => setSeats(result.seats)).catch(() => undefined)
  }, [rows])
  const hide = async (passenger: ApiPassenger) => { setBusyId(passenger.id); try { await api.hideTestPassenger(passenger.trip_id, passenger.id); setRows((current) => current.filter((item) => item.id !== passenger.id)); window.dispatchEvent(new Event('refresh-seat-boarding')) } catch { /* keep the row when the request fails */ } finally { setBusyId(null) } }
  const remove = async (passenger: ApiPassenger) => { if (!window.confirm(`Remove test passenger ${passenger.employee_name} permanently?`)) return; setBusyId(passenger.id); try { await api.removeTestPassenger(passenger.trip_id, passenger.id); setRows((current) => current.filter((item) => item.id !== passenger.id)); window.dispatchEvent(new Event('refresh-seat-boarding')) } catch { /* keep the row when the request fails */ } finally { setBusyId(null) } }
  const passengerBySeat = new Map(rows.map((passenger) => [passenger.seat_number, passenger]))
  const seatRows = Array.from(new Set(seats.map((seat) => Number(seat.row_position)))).sort((a, b) => a - b)
  return <div className={`passenger-manifest ${testPreview ? 'test-preview-manifest' : ''}`}><div className="manifest-toolbar"><div><span className="eyebrow small">{testPreview ? 'TEST MANIFEST · EMPLOYEE PREVIEW' : 'TRIP MANIFEST'}</span><strong>Passenger list</strong><span>{rows.length} passenger{rows.length === 1 ? '' : 's'} boarded</span></div><div className="manifest-view-toggle"><button type="button" className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>List</button><button type="button" className={view === 'bus' ? 'active' : ''} onClick={() => setView('bus')}>Bus view</button></div></div>{view === 'bus' ? <div className="manifest-bus-view"><div className="manifest-bus-front"><BusFront size={15} /> FRONT / DRIVER</div><div className="manifest-bus-body">{seatRows.map((row) => <div className="manifest-bus-row" key={row}>{seats.filter((seat) => Number(seat.row_position) === row).sort((a, b) => Number(a.column_position) - Number(b.column_position)).map((seat) => { const passenger = passengerBySeat.get(seat.seat_number); const disabled = seat.seat_type !== 'PASSENGER' || !seat.is_active; return <div className={`manifest-bus-seat ${passenger ? 'occupied' : disabled ? 'disabled' : 'available'}`} key={seat.id}><strong>{seat.seat_number}</strong>{passenger && <><span>{passenger.employee_number}</span><small>{passenger.employee_name}</small></>}</div> })}</div>)}</div><div className="manifest-bus-legend"><span><i className="available" />Available</span><span><i className="occupied" />Occupied</span><span><i className="disabled" />Unavailable</span></div></div> : rows.length ? rows.map((passenger) => <div className="passenger-manifest-row" key={passenger.id}><strong>Seat {passenger.seat_number}</strong><span>{passenger.employee_number} · {passenger.employee_name}{passenger.is_test ? ' · TEST' : ''}</span><time>{formatBoardedAt(passenger.boarded_at)}{passenger.boarding_stop_name ? ` · ${passenger.boarding_stop_name}` : ''}</time>{passenger.is_test && !readOnly ? <div className="test-passenger-actions"><button type="button" className="secondary-button compact" disabled={busyId === passenger.id} onClick={() => void hide(passenger)}>Hide</button><button type="button" className="secondary-button compact danger" disabled={busyId === passenger.id} onClick={() => void remove(passenger)}>Remove</button>{passenger.signature_data && <img src={passenger.signature_data} alt="Test passenger signature" />}</div> : null}</div>) : <div className="seat-empty">No passengers have boarded this trip.</div>}</div>
}

function LegacyPassengerManifest({ passengers }: { passengers: ApiPassenger[] }) {
  return <div className="passenger-manifest">{passengers.length ? passengers.map((passenger) => <div className="passenger-manifest-row" key={passenger.id}><strong>Seat {passenger.seat_number}</strong><span>{passenger.employee_number} · {passenger.employee_name}</span><time>{formatBoardedAt(passenger.boarded_at)}{passenger.boarding_stop_name ? ` · ${passenger.boarding_stop_name}` : ''}</time></div>) : <div className="seat-empty">No passengers have boarded this trip.</div>}</div>
}

export default function SeatBoarding({ shuttleId, user, userLocation, notify }: Props) {
  const [tripId, setTripId] = useState<number | null>(null)
  const [stateValue, setState] = useState<ApiBoardingState | null>(null)
  const state = stateValue! as ApiBoardingState & { passenger: NonNullable<ApiBoardingState['passenger']> }
  const [passengers, setPassengers] = useState<ApiPassenger[]>([])
  const [testPassengers, setTestPassengers] = useState<ApiPassenger[]>([])
  const [loading, setLoading] = useState(true)
  const [showSeats, setShowSeats] = useState(false)
  const [showManifest, setShowManifest] = useState(false)
  const [showTestManifest, setShowTestManifest] = useState(false)
  const [showTestPassenger, setShowTestPassenger] = useState(false)
  const [testEmployeeNumber, setTestEmployeeNumber] = useState('')
  const [testEmployeeName, setTestEmployeeName] = useState('')
  const [testSeatId, setTestSeatId] = useState('')
  const [testFormError, setTestFormError] = useState('')
  const testSignatureRef = useRef('')
  const [selectedSeatId, setSelectedSeatId] = useState<number | null>(null)
  const [signature, setSignature] = useState('')
  const [saving, setSaving] = useState(false)
  const role = user.role === 'PASSENGER' ? 'USER' : user.role
  const socket = getRealtimeSocket()

  const load = async () => {
    if (!shuttleId) return
    try {
      const { trips } = await api.activeTrips()
      const trip = trips.find((item) => item.shuttle_id === shuttleId)
      setTripId(trip?.id || null)
      if (!trip) { setState(null); setPassengers([]); setTestPassengers([]); return }
      const location = userLocation || { latitude: 0, longitude: 0, accuracy: 99999 }
      const [boarding, passengerResult, testPassengerResult] = await Promise.all([api.tripBoarding(trip.id, location), api.tripPassengers(trip.id).catch(() => ({ passengers: [] })), role === 'USER' ? api.tripPassengers(trip.id, false, true).catch(() => ({ passengers: [] })) : Promise.resolve({ passengers: [] })])
      setState(boarding); setPassengers(passengerResult.passengers); setTestPassengers(testPassengerResult.passengers)
    } catch { /* live tracking may refresh while a trip is being created */ } finally { setLoading(false) }
  }

  useEffect(() => { setLoading(true); void load(); const timer = window.setInterval(() => void load(), 5000); return () => window.clearInterval(timer) }, [shuttleId, userLocation?.latitude, userLocation?.longitude, userLocation?.accuracy])
  useEffect(() => {
    const refresh = (event: { tripId?: number }) => { if (!tripId || Number(event.tripId) !== tripId) return; void load() }
    if (tripId) socket.emit('trip:join', { tripId })
    socket.on('trip_seat_occupied', refresh); socket.on('trip_capacity_updated', refresh); socket.on('trip_seat_held', refresh); socket.on('trip_seat_hold_released', refresh); socket.on('boarding_state_updated', refresh)
    const refreshAfterTestAction = () => void load()
    window.addEventListener('refresh-seat-boarding', refreshAfterTestAction)
    return () => { socket.off('trip_seat_occupied', refresh); socket.off('trip_capacity_updated', refresh); socket.off('trip_seat_held', refresh); socket.off('trip_seat_hold_released', refresh); socket.off('boarding_state_updated', refresh); window.removeEventListener('refresh-seat-boarding', refreshAfterTestAction) }
  }, [tripId, shuttleId, userLocation?.latitude, userLocation?.longitude, userLocation?.accuracy])

  const selectSeat = async (seatId: number) => {
    if (!tripId || !state || !userLocation || !state.eligibility.open) return
    setSaving(true)
    try { await api.holdTripSeat(tripId, seatId, userLocation); setSelectedSeatId(seatId); setSignature(''); setShowSeats(false) } catch (error) { notify(error instanceof Error ? error.message : 'Could not hold this seat.'); void load() } finally { setSaving(false) }
  }
  const cancelBoarding = async () => { if (tripId && selectedSeatId) await api.releaseTripSeatHold(tripId, selectedSeatId).catch(() => undefined); setSelectedSeatId(null); setSignature(''); void load() }
  const confirm = async () => {
    if (!tripId || !selectedSeatId || !signature || !userLocation) return notify('Please sign before confirming boarding.')
    setSaving(true)
    try { const result = await api.boardTrip(tripId, { seatId: selectedSeatId, signatureData: signature, ...userLocation }); notify(`Boarding confirmed on seat ${result.seatNumber}.`); setSelectedSeatId(null); setSignature(''); await load() } catch (error) { notify(error instanceof Error ? error.message : 'Could not confirm boarding.'); await cancelBoarding() } finally { setSaving(false) }
  }
  const addTestPassenger = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!tripId) return setTestFormError('No active trip is available for this passenger.')
    if (!testEmployeeNumber.trim()) return setTestFormError('Employee number is required.')
    if (!testEmployeeName.trim()) return setTestFormError('Employee name is required.')
    if (!testSeatId) return setTestFormError('Seat is required. Select an available seat.')
    setTestFormError('')
    setSaving(true)
    try { await api.addTestPassenger(tripId, { seatId: Number(testSeatId), employeeNumber: testEmployeeNumber.trim(), employeeName: testEmployeeName.trim(), signatureData: testSignatureRef.current || undefined }); notify('Test passenger added to the manifest.'); setTestEmployeeNumber(''); setTestEmployeeName(''); setTestSeatId(''); testSignatureRef.current = ''; await load() } catch (error) { setTestFormError(error instanceof Error ? error.message : 'Could not add test passenger.') } finally { setSaving(false) }
  }
  useEffect(() => {
    if (role === 'USER' || !showTestPassenger) return
    const form = document.querySelector('.test-passenger-form')
    if (!(form instanceof HTMLFormElement)) return
    const wrapper = document.createElement('div')
    wrapper.className = 'test-signature-input'
    wrapper.innerHTML = '<label>Electronic signature</label><canvas aria-label="Test electronic signature"></canvas><button type="button">Clear signature</button>'
    const canvas = wrapper.querySelector('canvas')
    const clearButton = wrapper.querySelector('button')
    if (!canvas || !clearButton) return
    canvas.width = 700
    canvas.height = 150
    const context = canvas.getContext('2d')
    if (!context) return
    context.lineWidth = 3
    context.lineCap = 'round'
    context.strokeStyle = '#216da8'
    let drawing = false
    const point = (event: PointerEvent) => { const rect = canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height } }
    const down = (event: PointerEvent) => { canvas.setPointerCapture(event.pointerId); drawing = true; const position = point(event); context.beginPath(); context.moveTo(position.x, position.y) }
    const move = (event: PointerEvent) => { if (!drawing) return; const position = point(event); context.lineTo(position.x, position.y); context.stroke() }
    const up = () => { if (!drawing) return; drawing = false; testSignatureRef.current = canvas.toDataURL('image/png') }
    const clear = () => { context.clearRect(0, 0, canvas.width, canvas.height); testSignatureRef.current = '' }
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up); clearButton.addEventListener('click', clear)
    const closeButton = document.createElement('button')
    closeButton.type = 'button'
    closeButton.className = 'test-modal-close'
    closeButton.setAttribute('aria-label', 'Close test passenger')
    closeButton.textContent = '×'
    closeButton.addEventListener('click', () => setShowTestPassenger(false))
    form.insertBefore(wrapper, form.querySelector('small'))
    form.appendChild(closeButton)
    return () => { canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up); clearButton.removeEventListener('click', clear); closeButton.removeEventListener('click', () => setShowTestPassenger(false)); wrapper.remove(); closeButton.remove() }
  }, [role, showTestPassenger])
  useEffect(() => {
    if (role === 'USER' || !showTestPassenger || !state) return
    const form = document.querySelector('.test-passenger-form')
    const select = form?.querySelector('select')
    if (!(form instanceof HTMLFormElement) || !(select instanceof HTMLSelectElement) || !select.parentElement) return
    const field = select.parentElement
    const picker = document.createElement('div')
    picker.className = 'test-seat-picker'
    picker.innerHTML = '<span class="test-seat-picker-label">Select a seat</span><div class="test-seat-picker-front"><strong>DRIVER</strong><strong>DOOR</strong></div>'
    const rows = Array.from(new Set(state.seats.map((seat) => Number(seat.row_position)))).sort((a, b) => a - b)
    const maxColumn = Math.max(1, ...state.seats.map((seat) => Number(seat.column_position) || 1))
    rows.forEach((rowNumber) => {
      const row = document.createElement('div')
      row.className = 'test-seat-picker-row'
      row.style.gridTemplateColumns = `repeat(${maxColumn}, minmax(28px, 1fr))`
      state.seats.filter((seat) => Number(seat.row_position) === rowNumber).sort((a, b) => Number(a.column_position) - Number(b.column_position)).forEach((seat) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.textContent = seat.seat_number
        const seatState = String(seat.state || '').toUpperCase()
        const seatClass = seatState === 'AVAILABLE' ? 'available' : ['OCCUPIED', 'TAKEN', 'BOOKED', 'HELD'].includes(seatState) ? 'occupied' : 'unavailable'
        button.className = `test-seat-picker-seat ${seatClass}${String(seat.id) === testSeatId ? ' selected' : ''}`
        button.disabled = seat.state !== 'AVAILABLE'
        button.title = `${seat.seat_number} · ${seat.state}`
        button.addEventListener('click', () => setTestSeatId(String(seat.id)))
        row.appendChild(button)
      })
      picker.appendChild(row)
    })
    select.style.display = 'none'
    field.appendChild(picker)
    return () => { select.style.display = ''; picker.remove() }
  }, [role, showTestPassenger, state, testSeatId])
  useEffect(() => {
    if (role === 'USER' || !showTestPassenger) return
    const form = document.querySelector('.test-passenger-form')
    if (!(form instanceof HTMLFormElement)) return
    const error = document.createElement('div')
    error.className = 'test-passenger-error'
    error.setAttribute('role', 'alert')
    error.textContent = testFormError
    const note = form.querySelector('small')
    if (testFormError) {
      if (note) form.insertBefore(error, note)
      else form.appendChild(error)
    }
    return () => error.remove()
  }, [role, showTestPassenger, testFormError])
  useEffect(() => {
    if (role === 'USER' || !showTestPassenger || !state) return
    const form = document.querySelector('.test-passenger-form')
    if (!(form instanceof HTMLFormElement)) return
    const panel = document.createElement('aside')
    panel.className = 'test-passenger-info-panel'
    panel.innerHTML = '<div class="test-panel-trip"><strong></strong><span></span><em></em></div><div class="test-panel-summary"><div><strong></strong><span>Passengers</span></div><div><strong></strong><span>Available</span></div><div><strong></strong><span>Current stop</span></div></div><div class="test-panel-seat"><strong></strong><span></span><button type="button">Select this seat</button></div><div class="test-panel-legend"><h4>Seat legend</h4><div><i class="available"></i><strong>Available</strong><span>Can be selected</span></div><div><i class="occupied"></i><strong>Occupied</strong><span>Already taken</span></div><div><i class="selected"></i><strong>Selected</strong><span>Currently selected</span></div><div><i class="disabled"></i><strong>Unavailable</strong><span>Driver, door, aisle</span></div></div><div class="test-panel-note"><strong>Test Mode</strong><span>This record is for testing the manifest and e-signature flow.</span></div>'
    const selectedSeat = state.seats.find((seat) => String(seat.id) === testSeatId)
    const trip = panel.querySelector('.test-panel-trip')
    if (trip) { trip.querySelector('strong')!.textContent = state.trip.bus_number || state.trip.shuttle_id; trip.querySelector('span')!.textContent = state.trip.route_name || 'Incoming route'; trip.querySelector('em')!.textContent = state.trip.status.replace(/_/g, ' ') }
    const summary = panel.querySelectorAll('.test-panel-summary strong')
    if (summary[0]) summary[0].textContent = `${state.occupied} / ${state.capacity}`
    if (summary[1]) summary[1].textContent = String(state.available)
    if (summary[2]) summary[2].textContent = state.eligibility.next_stop || '—'
    const selected = panel.querySelector('.test-panel-seat')
    if (selected) { selected.querySelector('strong')!.textContent = selectedSeat ? `Seat ${selectedSeat.seat_number}` : 'Select a seat'; selected.querySelector('span')!.textContent = selectedSeat ? (selectedSeat.state || 'AVAILABLE') : 'Choose an available seat from the bus map'; const selectButton = selected.querySelector('button') as HTMLButtonElement; selectButton.textContent = selectedSeat ? `Seat ${selectedSeat.seat_number} selected` : 'Select a seat'; selectButton.disabled = !selectedSeat; selectButton.addEventListener('click', () => document.querySelector<HTMLSelectElement>('.test-passenger-form select')?.focus()) }
    form.appendChild(panel)
    return () => panel.remove()
  }, [role, showTestPassenger, state, testSeatId])
  useEffect(() => {
    if (!showManifest && !showTestManifest) return
    const manifest = document.querySelector('.passenger-manifest')
    if (!manifest) return
    const closeButton = document.createElement('button')
    closeButton.type = 'button'
    closeButton.className = 'manifest-close-button'
    closeButton.setAttribute('aria-label', 'Close manifest')
    closeButton.textContent = '×'
    closeButton.addEventListener('click', () => { setShowManifest(false); setShowTestManifest(false) })
    manifest.appendChild(closeButton)
    return () => { closeButton.remove() }
  }, [showManifest, showTestManifest])
  useEffect(() => {
    if (!showSeats) return
    const seatMap = document.querySelector('.redesigned-seat-map')
    if (!seatMap) return
    const closeButton = document.createElement('button')
    closeButton.type = 'button'
    closeButton.className = 'seat-map-modal-close'
    closeButton.setAttribute('aria-label', 'Close seat map')
    closeButton.textContent = '×'
    closeButton.addEventListener('click', () => setShowSeats(false))
    seatMap.appendChild(closeButton)
    return () => { closeButton.remove() }
  }, [showSeats])
  if (loading && !state) return null
  if (!tripId || !stateValue) return <div className="boarding-card boarding-empty"><Users size={16} /><span>No active passenger boarding for this shuttle.</span></div>
  const selectedSeat = state.seats.find((seat) => Number(seat.id) === selectedSeatId)!
  if (role !== 'USER') return <div className="boarding-card"><div className="boarding-heading"><div><span className="eyebrow small">PASSENGER OPERATIONS</span><strong>{state.occupied} / {state.capacity} passengers</strong></div><div className="boarding-heading-actions"><button className="secondary-button compact" onClick={() => { setShowManifest((value) => !value); if (!showManifest) void load() }}>{showManifest ? 'Hide manifest' : 'View manifest'}</button><button className="primary-button compact" onClick={() => setShowTestPassenger((value) => !value)}>{showTestPassenger ? 'Close test input' : 'Add test passenger'}</button></div></div>{showTestPassenger && <form className="test-passenger-form" onSubmit={(event) => void addTestPassenger(event)}><label>Employee number<input value={testEmployeeNumber} onChange={(event) => setTestEmployeeNumber(event.target.value.toUpperCase())} placeholder="EMP-001" /></label><label>Employee name<input value={testEmployeeName} onChange={(event) => setTestEmployeeName(event.target.value)} placeholder="Test Passenger" /></label><label>Seat<select value={testSeatId} onChange={(event) => setTestSeatId(event.target.value)}><option value="">Select available seat</option>{state.seats.filter((seat) => seat.state === 'AVAILABLE').map((seat) => <option key={seat.id} value={seat.id}>{seat.seat_number}</option>)}</select></label><button className="primary-button compact" disabled={saving} type="submit">{saving ? 'Adding…' : 'Add to manifest'}</button><small>TEST record only. No employee GPS or signature is required.</small></form>}{showManifest && <PassengerManifest passengers={passengers} />}</div>
  return <div className="boarding-card"><div className="boarding-heading"><div><span className="eyebrow small">BUS SEATS</span><strong>{state.occupied} / {state.capacity} occupied</strong><span>{state.available ? `${state.available} seats available` : 'FULL'}</span></div><div className="boarding-heading-actions"><button className="secondary-button compact" onClick={() => setShowTestManifest((value) => !value)}>{showTestManifest ? 'Hide test manifest' : 'View test manifest'}</button><button className="secondary-button compact" onClick={() => setShowSeats((value) => !value)} disabled={!state.seats.length}>{showSeats ? 'Hide seats' : 'View seats'}</button></div></div>{showTestManifest && <PassengerManifest passengers={testPassengers} readOnly testPreview />}{state.passenger ? <div className="my-boarding"><Check size={16} /><div><strong>MY BOARDING · Seat {state.passenger.seat_number}</strong><span>Boarded {formatBoardedAt(state.passenger.boarded_at)}{state.passenger.boarding_stop_name ? ` · ${state.passenger.boarding_stop_name}` : ''}</span></div></div> : <div className={`boarding-status ${state.eligibility.open ? 'open' : ''}`}><span className="boarding-status-dot" /><div><strong>{state.eligibility.open ? 'BOARDING OPEN' : 'BOARDING NOT OPEN'}</strong><span>{userLocation ? state.eligibility.message : 'Allow phone location to check whether you are near the shuttle.'}</span></div></div>}{showSeats && <><SeatMap state={state} onSelect={(seatId) => void selectSeat(seatId)} />{!state.eligibility.open && <small className="seat-selection-note">Seat selection becomes available when the shuttle is at your boarding location and has stopped.</small>}</>}{selectedSeat && <div className="boarding-modal-backdrop"><section className="boarding-modal"><div className="boarding-modal-heading"><div><span className="eyebrow small">CONFIRM BOARDING</span><h3>{state.trip.bus_number || state.trip.shuttle_id} · Seat {selectedSeat.seat_number}</h3></div><button className="close-small" onClick={() => void cancelBoarding()}><X size={18} /></button></div><div className="boarding-summary"><span>Employee<strong>{user.name}</strong></span><span>Employee number<strong>{user.employee_number || 'Missing employee number'}</strong></span><span>Boarding stop<strong>{state.eligibility.next_stop || 'Pickup point'}</strong></span></div><div className="signature-heading"><PenLine size={15} /><strong>Signature</strong><span>Please sign below.</span></div><SignaturePad value={signature} onChange={setSignature} /><div className="boarding-modal-actions"><button className="secondary-button" onClick={() => void cancelBoarding()}>Cancel</button><button className="primary-button" disabled={saving || !signature || !user.employee_number} onClick={() => void confirm()}>{saving ? 'Confirming…' : 'Confirm boarding'}</button></div></section></div>}</div>
  return <div className="boarding-card"><div className="boarding-heading"><div><span className="eyebrow small">BUS SEATS</span><strong>{state.occupied} / {state.capacity} occupied</strong><span>{state.available ? `${state.available} seats available` : 'FULL'}</span></div><button className="secondary-button compact" onClick={() => setShowSeats((value) => !value)} disabled={!state.seats.length}>{showSeats ? 'Hide seats' : 'View seats'}</button></div>{state.passenger ? <div className="my-boarding"><Check size={16} /><div><strong>MY BOARDING · Seat {state.passenger.seat_number}</strong><span>Boarded {formatBoardedAt(state.passenger.boarded_at)}{state.passenger.boarding_stop_name ? ` · ${state.passenger.boarding_stop_name}` : ''}</span></div></div> : <div className={`boarding-status ${state.eligibility.open ? 'open' : ''}`}><span className="boarding-status-dot" /><div><strong>{state.eligibility.open ? 'BOARDING OPEN' : 'BOARDING NOT OPEN'}</strong><span>{userLocation ? state.eligibility.message : 'Allow phone location to check whether you are near the shuttle.'}</span></div></div>}{showSeats && <><SeatMap state={state} onSelect={(seatId) => void selectSeat(seatId)} />{!state.eligibility.open && <small className="seat-selection-note">Seat selection becomes available when the shuttle is at your boarding location and has stopped.</small>}</>}{selectedSeat && <div className="boarding-modal-backdrop"><section className="boarding-modal"><div className="boarding-modal-heading"><div><span className="eyebrow small">CONFIRM BOARDING</span><h3>{state.trip.bus_number || state.trip.shuttle_id} · Seat {selectedSeat.seat_number}</h3></div><button className="close-small" onClick={() => void cancelBoarding()}><X size={18} /></button></div><div className="boarding-summary"><span>Employee<strong>{user.name}</strong></span><span>Employee number<strong>{user.employee_number || 'Missing employee number'}</strong></span><span>Boarding stop<strong>{state.eligibility.next_stop || 'Pickup point'}</strong></span></div><div className="signature-heading"><PenLine size={15} /><strong>Signature</strong><span>Please sign below.</span></div><SignaturePad value={signature} onChange={setSignature} /><div className="boarding-modal-actions"><button className="secondary-button" onClick={() => void cancelBoarding()}>Cancel</button><button className="primary-button" disabled={saving || !signature || !user.employee_number} onClick={() => void confirm()}>{saving ? 'Confirming…' : 'Confirm boarding'}</button></div></section></div>}</div>
}
