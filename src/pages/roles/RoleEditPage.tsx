import ModulePageFrame from '../shared/ModulePageFrame'
export default function RoleEditPage({ roleId }: { roleId: string }) { return <ModulePageFrame title={`Edit role ${roleId}`} description="Update module permissions for this role." /> }
