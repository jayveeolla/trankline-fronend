import ModulePageFrame from '../shared/ModulePageFrame'
export default function RouteDetailPage({ routeId }: { routeId: string }) { return <ModulePageFrame title={`Route ${routeId}`} description="Inspect route coverage, pickup points, and service status." /> }
