import ModulePageFrame from '../shared/ModulePageFrame'
export default function DriverDetailPage({ driverId }: { driverId: string }) { return <ModulePageFrame title={`Driver ${driverId}`} description="Inspect driver status, shuttle assignment, and current trip." /> }
