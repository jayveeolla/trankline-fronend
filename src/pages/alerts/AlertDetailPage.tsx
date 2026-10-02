import ModulePageFrame from '../shared/ModulePageFrame'
export default function AlertDetailPage({ alertId }: { alertId: string }) { return <ModulePageFrame title={`Alert ${alertId}`} description="Inspect the alert, linked trip, shuttle, location, and timestamp." /> }
