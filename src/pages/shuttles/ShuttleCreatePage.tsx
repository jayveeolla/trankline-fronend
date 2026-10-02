import ShuttleWizard from '../../ShuttleWizard'
import { type ApiRoute } from '../../api'
import ModulePageFrame from '../shared/ModulePageFrame'

type Props = { routes: ApiRoute[]; notify: (message: string) => void; onSaved: () => void; onCancel: () => void }

export default function ShuttleCreatePage({ routes, notify, onSaved, onCancel }: Props) {
  return <ModulePageFrame title="Add shuttle" description="Create a shuttle record and configure its route.">
    <ShuttleWizard routes={routes} notify={notify} onSaved={onSaved} onCancel={onCancel} />
  </ModulePageFrame>
}
