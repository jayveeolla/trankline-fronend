import ModulePageFrame from '../shared/ModulePageFrame'
export default function StopDetailPage({ stopId }: { stopId: string }) { return <ModulePageFrame title={`Stop ${stopId}`} description="Inspect pickup point details and routes using this stop." /> }
