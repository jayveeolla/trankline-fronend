import { useEffect, useState } from 'react'
import { BusFront, History, LayoutGrid, Pencil } from 'lucide-react'
import { api, type ApiSeat, type ApiShuttle } from '../../api'
import SeatMapPreview from '../../SeatMapPreview'
import ModulePageFrame from '../shared/ModulePageFrame'

export default function ShuttleDetailPage({ shuttle, onNavigate }: { shuttle?: ApiShuttle; onNavigate: (path: string) => void }) {
  const [seats, setSeats] = useState<ApiSeat[]>([])

  useEffect(() => {
    if (!shuttle) return
    let active = true
    api.shuttleSeats(shuttle.id).then(({ seats: nextSeats }) => { if (active) setSeats(nextSeats) }).catch(() => { if (active) setSeats([]) })
    return () => { active = false }
  }, [shuttle?.id])

  if (!shuttle) return <ModulePageFrame title="Shuttle not found" description="The requested shuttle could not be loaded." />

  return <ModulePageFrame title={shuttle.id} description="Dedicated shuttle details and operational actions.">
    <div className="shuttle-detail-layout">
      <div className="module-detail-card">
        <div className="module-detail-icon"><BusFront size={22} /></div>
        <div><strong>{shuttle.bus_number || shuttle.id}</strong><span>{shuttle.route || 'Unassigned route'}</span></div>
        <dl><dt>Plate number</dt><dd>{shuttle.plate_number || '—'}</dd><dt>Vehicle type</dt><dd>{shuttle.vehicle_type || shuttle.vehicle_name || '—'}</dd><dt>Capacity</dt><dd>{shuttle.capacity || '—'}</dd><dt>Status</dt><dd>{shuttle.status}</dd><dt>Driver</dt><dd>{shuttle.driver || 'Not assigned'}</dd></dl>
        <div className="module-detail-actions"><button className="secondary-button compact" onClick={() => onNavigate(`/shuttles/${encodeURIComponent(shuttle.id)}/edit`)}><Pencil size={14} /> Edit shuttle</button><button className="secondary-button compact" onClick={() => onNavigate(`/shuttles/${encodeURIComponent(shuttle.id)}/seat-layout`)}><LayoutGrid size={14} /> Seat layout</button><button className="primary-button compact" onClick={() => onNavigate(`/shuttles/${encodeURIComponent(shuttle.id)}/history`)}><History size={14} /> View history</button></div>
      </div>
      <section className="shuttle-detail-seat-card">
        <div className="shuttle-detail-seat-heading"><div><h2>Seat layout</h2><p>Seat types and current availability for this shuttle.</p></div><span>{seats.length || shuttle.capacity || '—'} seats</span></div>
        {seats.length ? <SeatMapPreview seats={seats} /> : <div className="shuttle-detail-seat-empty">Seat layout is not available yet.</div>}
      </section>
    </div>
  </ModulePageFrame>
}
