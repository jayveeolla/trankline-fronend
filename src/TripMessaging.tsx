import { useEffect, useMemo, useState } from 'react'
import { Bell, Check, ChevronDown, MapPin, MessageCircle, Pin, Send, Star, TriangleAlert } from 'lucide-react'
import { api, type ApiRouteStop, type ApiTripMessage, type SessionUser } from './api'
import { getRealtimeSocket } from './realtime'

type TripMessagingProps = {
  shuttleId: string
  routeName: string
  routeStops?: ApiRouteStop[]
  user: SessionUser
  notify?: (message: string) => void
  onViewMap?: (latitude: number, longitude: number, label: string) => void
}

const quickUpdates = [
  ['HEAVY_TRAFFIC', 'Heavy traffic', 'warning'],
  ['ARRIVING_NEXT_STOP', 'Arriving at next stop', 'info'],
  ['FULL_NO_SEATS', 'Full / no seats', 'warning'],
  ['DELAYED', 'Delayed', 'warning'],
  ['GPS_ISSUE', 'GPS issue', 'critical'],
  ['VEHICLE_ISSUE', 'Vehicle issue', 'critical'],
] as const

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function TripMessaging({ shuttleId, routeName, routeStops = [], user, notify, onViewMap }: TripMessagingProps) {
  const [tripId, setTripId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ApiTripMessage[]>([])
  const [stopStatuses, setStopStatuses] = useState<Record<number, string>>({})
  const [tab, setTab] = useState<'overview' | 'stops' | 'updates'>('updates')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [following, setFollowing] = useState(false)
  const [error, setError] = useState('')
  const role = user.role === 'PASSENGER' ? 'USER' : user.role
  const canQuickUpdate = role === 'DRIVER' || role === 'ADMIN'
  const socket = getRealtimeSocket()

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setTripId(null)
    setMessages([])
    setStopStatuses({})
    api.activeTrips().then(async ({ trips }) => {
      const trip = trips.find((item) => item.shuttle_id === shuttleId)
      if (!active || !trip) return
      setTripId(trip.id)
      const [messageResult, followResult, stopResult] = await Promise.all([api.tripMessages(trip.id), api.tripFollowStatus(trip.id).catch(() => ({ following: false })), api.tripStopStatus(trip.id).catch(() => ({ stopStatus: [] }))])
      if (!active) return
      setMessages(messageResult.messages)
      setFollowing(followResult.following)
      setStopStatuses(Object.fromEntries(stopResult.stopStatus.map((stop) => [Number(stop.stop_id), stop.status])))
      socket.emit('trip:join', { tripId: trip.id })
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Unable to load trip updates.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [shuttleId])

  useEffect(() => {
    const onMessage = (message: ApiTripMessage) => {
      if (message.trip_id !== tripId) return
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message])
    }
    const onDeleted = (message: ApiTripMessage) => { if (message.trip_id === tripId) setMessages((current) => current.map((item) => item.id === message.id ? message : item)) }
    const onPinned = (message: ApiTripMessage) => { if (message.trip_id === tripId) setMessages((current) => current.map((item) => item.id === message.id ? message : item)) }
    const onStopEvent = (event: { tripId?: number; stopId?: number; type?: string }) => {
      if (event.tripId !== tripId || !event.stopId) return
      setStopStatuses((current) => ({ ...current, [Number(event.stopId)]: event.type === 'departed' ? 'PASSED' : event.type === 'arrived' ? 'ARRIVED' : 'APPROACHING' }))
    }
    const onTripCompleted = (trip: { id?: number }) => {
      if (trip.id !== tripId) return
      setStopStatuses((current) => Object.fromEntries(Object.keys(current).map((stopId) => [stopId, 'PASSED'])))
    }
    socket.on('trip_message_created', onMessage)
    socket.on('trip_message_deleted', onDeleted)
    socket.on('trip_message_pinned', onPinned)
    socket.on('stop:approaching', onStopEvent)
    socket.on('stop:arrived', onStopEvent)
    socket.on('stop:departed', onStopEvent)
    socket.on('trip:completed', onTripCompleted)
    return () => { socket.off('trip_message_created', onMessage); socket.off('trip_message_deleted', onDeleted); socket.off('trip_message_pinned', onPinned); socket.off('stop:approaching', onStopEvent); socket.off('stop:arrived', onStopEvent); socket.off('stop:departed', onStopEvent); socket.off('trip:completed', onTripCompleted) }
  }, [tripId, socket])

  const sortedMessages = useMemo(() => [...messages].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [messages])
  const send = async () => {
    if (!tripId || !text.trim() || sending) return
    setSending(true)
    try {
      const result = await api.sendTripMessage(tripId, { message: text.trim(), messageType: role === 'DRIVER' ? 'DRIVER_UPDATE' : role === 'ADMIN' ? 'ADMIN_ANNOUNCEMENT' : 'USER_MESSAGE' })
      setMessages((current) => current.some((item) => item.id === result.message.id) ? current : [...current, result.message])
      setText('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to send message.') } finally { setSending(false) }
  }
  const sendQuick = async (kind: string) => {
    if (!tripId || sending) return
    setSending(true)
    try {
      const result = await api.sendQuickTripUpdate(tripId, { kind })
      setMessages((current) => current.some((item) => item.id === result.message.id) ? current : [...current, result.message])
      notify?.('Trip update broadcast')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to send quick update.') } finally { setSending(false) }
  }
  const toggleFollow = async () => {
    if (!tripId) return
    try {
      const result = following ? await api.unfollowTrip(tripId) : await api.followTrip(tripId)
      setFollowing(result.following)
      notify?.(result.following ? 'Trip followed' : 'Trip unfollowed')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to update trip follow.') }
  }

  return <section className="trip-messaging-card">
    <div className="trip-messaging-heading"><div><div className="section-kicker"><MessageCircle size={14} /> TRIP COMMUNICATION</div><h3>{tripId ? `${shuttleId} live updates` : 'Trip updates'}</h3><span>{routeName}</span></div>{tripId && <button className={`follow-trip-button ${following ? 'following' : ''}`} onClick={() => void toggleFollow()}><Star size={14} /> {following ? 'Following' : 'Follow trip'}</button>}</div>
    <div className="trip-tabs"><button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>Overview</button><button className={tab === 'stops' ? 'active' : ''} onClick={() => setTab('stops')}>Stops <span>{routeStops.length}</span></button><button className={tab === 'updates' ? 'active' : ''} onClick={() => setTab('updates')}>Updates <span>{messages.length}</span></button></div>
    {loading ? <div className="messaging-empty">Loading trip communication…</div> : !tripId ? <div className="messaging-empty"><Bell size={18} /> No active trip for this shuttle. Updates appear here when the driver starts the trip.</div> : tab === 'overview' ? <div className="messaging-overview"><div><strong>Live trip room</strong><span>Messages, alerts, and stop events are scoped to this trip.</span></div><div><strong>{messages.filter((item) => item.message_type !== 'USER_MESSAGE').length}</strong><span>operational updates</span></div><div><strong>{following ? 'Yes' : 'No'}</strong><span>following this trip</span></div></div> : tab === 'stops' ? <div className="messaging-stops">{routeStops.length ? routeStops.map((stop, index) => { const status = stopStatuses[Number(stop.stop_id)] || 'UPCOMING'; const label = status === 'PASSED' ? 'Passed' : status === 'ARRIVED' ? 'Arrived' : status === 'APPROACHING' ? 'Approaching' : 'Upcoming pickup point'; return <div className={`messaging-stop-row ${status.toLowerCase()}`} key={stop.stop_id}><span className="messaging-stop-number">{index + 1}</span><div><strong>{stop.pickup_name}</strong><small>{label}</small></div><ChevronDown size={15} /></div> }) : <div className="messaging-empty">No route stops available.</div>}</div> : <>
      {canQuickUpdate && <div className="quick-update-grid">{quickUpdates.map(([kind, label, tone]) => <button key={kind} className={`quick-update ${tone}`} disabled={sending} onClick={() => void sendQuick(kind)}><TriangleAlert size={14} />{label}</button>)}</div>}
      {error && <div className="messaging-error">{error}</div>}
      <div className="message-feed">{sortedMessages.length ? sortedMessages.map((message) => <article className={`message-row severity-${message.severity.toLowerCase()} ${message.is_deleted ? 'deleted' : ''}`} key={message.id}><div className="message-avatar">{message.sender_role === 'SYSTEM' ? <Bell size={14} /> : message.sender_name?.slice(0, 1).toUpperCase() || 'U'}</div><div className="message-copy"><div className="message-meta"><strong>{message.sender_role === 'SYSTEM' ? 'Trackline system' : message.sender_name || message.sender_role}</strong><span>{formatTime(message.created_at)}</span>{message.is_pinned ? <Pin size={12} /> : null}</div><p>{message.message}</p><div className="message-actions">{message.stop_name && <span className="message-location"><MapPin size={12} /> {message.stop_name}</span>}{message.latitude !== null && message.longitude !== null && onViewMap && <button onClick={() => onViewMap(Number(message.latitude), Number(message.longitude), message.message)}><MapPin size={12} /> View on map</button>}</div></div></article>) : <div className="messaging-empty">No updates yet. Start the trip to generate system messages.</div>}</div>
      <div className="message-composer"><textarea value={text} maxLength={500} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send() } }} placeholder={role === 'DRIVER' ? 'Send a trip update…' : 'Send a message to this trip…'} /><button disabled={sending || !text.trim()} onClick={() => void send()}><Send size={15} /> Send</button></div><small className="composer-hint">{text.length}/500 · Enter to send, Shift+Enter for a new line</small>
    </>}
  </section>
}
