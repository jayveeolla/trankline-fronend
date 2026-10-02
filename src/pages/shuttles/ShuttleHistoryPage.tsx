import TripHistoryPage from '../../TripHistoryPage'
export default function ShuttleHistoryPage({ shuttleId, notify, onBack }: { shuttleId: string; notify: (message: string) => void; onBack: () => void }) { return <TripHistoryPage notify={notify} shuttleId={shuttleId} onClearShuttle={onBack} /> }
