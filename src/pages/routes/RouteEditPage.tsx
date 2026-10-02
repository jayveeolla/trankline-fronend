import { useEffect, useState } from 'react'
import RouteEditor from '../../RouteEditor'
import { api, type ApiRoute } from '../../api'
import ModulePageFrame from '../shared/ModulePageFrame'

type Props = { routeId: string; notify: (message: string) => void; onSaved: () => void; onCancel: () => void }

export default function RouteEditPage({ routeId, notify, onSaved, onCancel }: Props) {
  const [route, setRoute] = useState<ApiRoute | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let active = true
    api.routes().then(({ routes }) => { const found = routes.find((item) => String(item.id) === routeId); if (!active) return; setRoute(found || null); setNotFound(!found) }).catch(() => { if (active) setNotFound(true) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [routeId])

  return <ModulePageFrame title={`Edit route ${routeId}`} description="Build the complete road route from the Philippine starting location to the locked TDK destination.">
    {loading ? <div className="module-empty-state"><strong>Loading route...</strong><span>Retrieving the current route configuration.</span></div> : notFound || !route ? <div className="module-empty-state"><strong>Route not found</strong><span>Route {routeId} is not available in the database.</span><button className="secondary-button compact" type="button" onClick={onCancel}>Back to routes</button></div> : <RouteEditor route={route} notify={notify} onSaved={onSaved} onCancel={onCancel} />}
  </ModulePageFrame>
}
