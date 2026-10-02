import { useEffect, useState } from 'react'
import { Bell, Check, MapPin, ShieldAlert, TriangleAlert } from 'lucide-react'
import { api, type ApiAlert, type SessionUser } from './api'
import { getRealtimeSocket } from './realtime'

export default function AlertsPanel({ user, notify, onUnreadChange }: { user: SessionUser; notify: (message: string) => void; onUnreadChange?: (count: number) => void }) {
  const [alerts, setAlerts] = useState<ApiAlert[]>([])
  const [filter, setFilter] = useState<'all' | 'unread' | 'critical'>('all')
  const [loading, setLoading] = useState(true)
  const socket = getRealtimeSocket()
  const load = async () => {
    setLoading(true)
    try {
      const result = await api.alerts({ unread: filter === 'unread', severity: filter === 'critical' ? 'CRITICAL' : undefined })
      setAlerts(result.alerts)
      onUnreadChange?.(result.unreadCount)
    } catch { /* the main dashboard remains usable if alerts are temporarily unavailable */ } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [filter])
  useEffect(() => {
    const refresh = () => { void load() }
    socket.on('trip_alert_created', refresh)
    socket.on('trip_alert_resolved', refresh)
    socket.on('alert_unread_count_updated', refresh)
    return () => { socket.off('trip_alert_created', refresh); socket.off('trip_alert_resolved', refresh); socket.off('alert_unread_count_updated', refresh) }
  }, [filter, socket])
  const markRead = async (alert: ApiAlert) => {
    if (alert.read_at) return
    await api.markAlertRead(alert.id)
    setAlerts((current) => current.map((item) => item.id === alert.id ? { ...item, read_at: new Date().toISOString() } : item))
    onUnreadChange?.(Math.max(0, alerts.filter((item) => !item.read_at && item.id !== alert.id).length))
  }
  const markAll = async () => { await api.markAllAlertsRead(); notify('Alerts marked as read'); void load() }
  return <section className="alerts-workspace"><div className="alerts-header"><div><div className="section-kicker"><Bell size={14} /> OPERATIONS CENTER</div><h2>Shuttle alerts</h2><p>Important service and trip events from the live fleet.</p></div><button className="secondary-button" onClick={() => void markAll()}><Check size={15} /> Mark all read</button></div><div className="alert-filters"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button><button className={filter === 'unread' ? 'active' : ''} onClick={() => setFilter('unread')}>Unread</button><button className={filter === 'critical' ? 'active' : ''} onClick={() => setFilter('critical')}>Critical</button></div>{loading ? <div className="messaging-empty">Loading alerts…</div> : alerts.length ? <div className="alerts-list">{alerts.map((alert) => <article className={`alert-card ${alert.severity.toLowerCase()} ${alert.read_at ? 'read' : 'unread'}`} key={alert.id} onClick={() => void markRead(alert)}><div className="alert-card-icon">{alert.severity === 'CRITICAL' ? <ShieldAlert size={17} /> : alert.severity === 'WARNING' ? <TriangleAlert size={17} /> : <Bell size={17} />}</div><div className="alert-card-copy"><div><strong>{alert.title}</strong><span>{new Date(alert.created_at).toLocaleString()}</span></div><p>{alert.message}</p><small>{alert.bus_number || alert.shuttle_id || 'Fleet'}{alert.route_name ? ` · ${alert.route_name}` : ''}</small>{alert.latitude !== null && alert.longitude !== null && <button className="alert-map-link" onClick={(event) => { event.stopPropagation(); notify(`Alert location: ${Number(alert.latitude).toFixed(5)}, ${Number(alert.longitude).toFixed(5)}`) }}><MapPin size={12} /> Location captured</button>}</div><div className="alert-card-state">{alert.resolved_at ? 'Resolved' : alert.read_at ? 'Read' : 'Unread'}</div></article>)}</div> : <div className="messaging-empty"><Bell size={18} /> No alerts in this view.</div>}</section>
}
