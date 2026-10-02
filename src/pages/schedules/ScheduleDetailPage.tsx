import ModulePageFrame from '../shared/ModulePageFrame'
export default function ScheduleDetailPage({ scheduleId }: { scheduleId: string }) { return <ModulePageFrame title={`Schedule ${scheduleId}`} description="Inspect route, shuttle, driver, departure time, and active days." /> }
