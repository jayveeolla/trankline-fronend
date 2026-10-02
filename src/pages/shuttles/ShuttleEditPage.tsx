import { useEffect, useState } from 'react'
import ShuttleWizard from '../../ShuttleWizard'
import { api, type ApiRoute, type ApiShuttle } from '../../api'
import ModulePageFrame from '../shared/ModulePageFrame'

type Props = { shuttleId: string; shuttle?: ApiShuttle; routes: ApiRoute[]; notify: (message: string) => void; onSaved: () => void; onCancel: () => void }

export default function ShuttleEditPage({ shuttleId, shuttle: initialShuttle, routes, notify, onSaved, onCancel }: Props) {
  const [shuttle, setShuttle] = useState<ApiShuttle | null>(initialShuttle || null)
  const [loading, setLoading] = useState(!initialShuttle)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (initialShuttle) { setShuttle(initialShuttle); setLoading(false); return }
    let active = true
    api.shuttles().then(({ shuttles }) => {
      if (!active) return
      const found = shuttles.find((item) => item.id === shuttleId)
      setShuttle(found || null); setNotFound(!found)
    }).catch(() => { if (active) setNotFound(true) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [initialShuttle, shuttleId])

  return <ModulePageFrame title={`Edit ${shuttleId}`} description="Update the shuttle record, route assignment, pickup points, and seat layout.">
    {loading ? <div className="module-empty-state"><strong>Loading shuttle…</strong><span>Retrieving the current shuttle configuration.</span></div> : notFound || !shuttle ? <div className="module-empty-state"><strong>Shuttle not found</strong><span>{shuttleId} is not available in the database.</span><button className="secondary-button compact" type="button" onClick={onCancel}>Back to Shuttles</button></div> : <ShuttleWizard routes={routes} shuttle={shuttle} notify={notify} onSaved={onSaved} onCancel={onCancel} />}
  </ModulePageFrame>
}
