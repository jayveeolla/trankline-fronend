import ModulePageFrame from '../shared/ModulePageFrame'
export default function UserDetailPage({ userId }: { userId: string }) { return <ModulePageFrame title={`User ${userId}`} description="Inspect employee account and role details." /> }
