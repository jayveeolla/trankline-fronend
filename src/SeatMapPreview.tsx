import type { ApiSeat } from './api'

type SeatMapPreviewProps = {
  seats: ApiSeat[]
  occupiedBySeat?: Map<string, string>
  selectedSeat?: string | null
  onSeatClick?: (seat: ApiSeat) => void
}

function seatStatus(seat: ApiSeat, occupiedBySeat: Map<string, string>) {
  if (occupiedBySeat.has(String(seat.seat_number)) || seat.state === 'OCCUPIED') return 'occupied'
  if (seat.state === 'HELD' || seat.state === 'HELD_BY_ME') return 'held'
  if (seat.seat_type !== 'PASSENGER' || !seat.is_active || seat.state === 'DISABLED') return 'unavailable'
  return 'available'
}

export default function SeatMapPreview({ seats, occupiedBySeat = new Map(), selectedSeat, onSeatClick }: SeatMapPreviewProps) {
  const maxRow = Math.max(1, ...seats.map((seat) => Number(seat.row_position) || 1))
  const maxColumn = Math.max(1, ...seats.map((seat) => Number(seat.column_position) || 1))
  const rows = Array.from({ length: maxRow }, (_, index) => index + 1)

  return <div className="shuttle-edit-bus shared-seat-preview">
    <span className="shuttle-edit-bus-end">FRONT ↑</span>
    <div className="shuttle-edit-bus-shell">
      <div className="shuttle-edit-bus-cabin"><span>DRIVER</span><span>DOOR</span></div>
      <div className="shuttle-edit-seat-grid" style={{ gridTemplateColumns: `repeat(${maxColumn}, minmax(0, 1fr))` }}>
        {rows.flatMap((row) => Array.from({ length: maxColumn }, (_, index) => index + 1).map((column) => {
          const seat = seats.find((item) => Number(item.row_position) === row && Number(item.column_position) === column)
          if (!seat) return <div className="shuttle-edit-seat empty" key={`${row}-${column}`} aria-hidden="true" />
          const status = seatStatus(seat, occupiedBySeat)
          return <button type="button" key={seat.id} className={`shuttle-edit-seat ${status} ${selectedSeat === seat.seat_number ? 'selected' : ''}`} onClick={() => onSeatClick?.(seat)}>
            <strong>{seat.seat_number}</strong>{occupiedBySeat.get(String(seat.seat_number)) && <small>{occupiedBySeat.get(String(seat.seat_number))}</small>}
          </button>
        }))}
      </div>
    </div>
    <span className="shuttle-edit-bus-end rear">REAR ↓</span>
  </div>
}
