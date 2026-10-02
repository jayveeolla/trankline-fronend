import RouteEditor from '../../RouteEditor'
import { type ApiRoute } from '../../api'
import ModulePageFrame from '../shared/ModulePageFrame'

type Props = { notify: (message: string) => void; onSaved: () => void; onCancel: () => void; routes?: ApiRoute[] }

export default function RouteCreatePage({ notify, onSaved, onCancel }: Props) {
  return <ModulePageFrame title="Create route" description="Build the complete road route from the Philippine starting location to the locked TDK destination.">
    <RouteEditor notify={notify} onSaved={onSaved} onCancel={onCancel} />
  </ModulePageFrame>
}
