import { BusFront, ChevronDown, MapPin, Route } from 'lucide-react'
import { type ApiRoute, type ApiShuttle, type ApiStop, type SessionUser } from '../../api'
import DriverTracking from '../../pages/driver-gps/DriverGpsReferencePage'
import GpsTestRunPage from '../../pages/gps-test-run/GpsTestRunPage'
import MaintenanceManager from '../../MaintenanceManager'
import TripHistoryPage from '../../TripHistoryPage'
import AlertsPanel from '../../AlertsPanel'
import { matchAppRoute } from './AppRouter'
import ShuttleDetailPage from '../../pages/shuttles/ShuttleDetailPage'
import ShuttleHistoryPage from '../../pages/shuttles/ShuttleHistoryPage'
import ShuttleSeatLayoutPage from '../../pages/shuttles/ShuttleSeatLayoutPage'
import ShuttleCreatePage from '../../pages/shuttles/ShuttleCreatePage'
import ShuttleEditPage from '../../pages/shuttles/ShuttleEditPage'
import RouteDetailPage from '../../pages/routes/RouteDetailPage'
import RouteCreatePage from '../../pages/routes/RouteCreatePage'
import RouteEditPage from '../../pages/routes/RouteEditPage'
import AlertDetailPage from '../../pages/alerts/AlertDetailPage'
import ModulePageFrame from '../../pages/shared/ModulePageFrame'
import ProfilePage from '../../pages/profile/ProfilePage'
import UsersPage from '../../pages/users/UsersPage'
import RoutesPage from '../../pages/routes/RoutesPage'
import ShuttlesPage from '../../pages/shuttles/ShuttlesPage'
import SettingsPage from '../../pages/settings/SettingsPage'

type ShuttleSummary = { id: string; route: string; driver: string; status: string }

export default function WorkspacePage({ section, routeKind, routeParams, navigate, theme, setTheme, notify, user, onProfileUpdated, routes, stops, shuttles, apiShuttles, settings, systemSettings, onChanged, onUnreadChange, onOpenShuttleHistory, historyShuttleId, onClearShuttleHistory }: { section: string; routeKind: ReturnType<typeof matchAppRoute>['kind']; routeParams: Record<string, string>; navigate: (path: string) => void; theme: 'dark' | 'light'; setTheme: (theme: 'dark' | 'light') => void; notify: (message: string) => void; user: SessionUser; onProfileUpdated: (user: SessionUser, token: string) => void; routes: ApiRoute[]; stops: ApiStop[]; shuttles: ShuttleSummary[]; apiShuttles?: ApiShuttle[]; settings: Record<string, string>; systemSettings: Record<string, string>; onChanged: () => void; onUnreadChange: (count: number) => void; onOpenShuttleHistory: (shuttleId: string) => void; historyShuttleId: string | null; onClearShuttleHistory: () => void }) {
  const descriptions: Record<string, string> = {
    Routes: 'View route coverage, pickup points, and current service status.',
    Shuttles: 'Manage the active fleet and inspect each vehicle GPS feed.',
    'Driver GPS': 'Broadcast live phone GPS for a shuttle trip headed to TDK.',
    'GPS Test Run': 'Run a database-backed simulated GPS trip along the saved road geometry.',
    Stops: 'Browse pickup points and see their live arrival coverage.',
    Drivers: 'Maintain drivers who operate the incoming shuttle fleet.',
    Assignments: 'Assign shuttles, drivers, and incoming TDK routes.',
    Schedules: 'Maintain incoming departure and expected TDK arrival times.',
    'Trip history': 'Review completed shuttle trips and their GPS summaries.',
    Alerts: 'Stay updated on service changes and GPS exceptions.',
    'Users & roles': 'Manage accounts, roles, driver links, passwords, and access status.',
    Profile: 'Update your account details and password.',
    Settings: 'Manage the way Trackline looks and behaves on this device.',
  }

  if (routeKind === 'shuttle-detail') return <ShuttleDetailPage shuttle={(apiShuttles || []).find((item) => item.id === routeParams.shuttleId)} onNavigate={navigate} />
  if (routeKind === 'shuttles' && routeParams.mode === 'new') return <ShuttleCreatePage routes={routes} notify={notify} onSaved={() => { onChanged(); navigate('/shuttles') }} onCancel={() => navigate('/shuttles')} />
  if (routeKind === 'shuttle-edit') {
    const editShuttleId = routeParams.shuttleId || 'Shuttle'
    return <ShuttleEditPage shuttleId={editShuttleId} shuttle={(apiShuttles || []).find((item) => item.id === editShuttleId)} routes={routes} notify={notify} onSaved={() => { onChanged(); navigate(`/shuttles/${encodeURIComponent(editShuttleId)}`) }} onCancel={() => navigate(`/shuttles/${encodeURIComponent(editShuttleId)}`)} />
  }
  if (routeKind === 'shuttle-seat-layout') return <ShuttleSeatLayoutPage shuttleId={routeParams.shuttleId || 'Shuttle'} onBack={() => navigate('/shuttles')} />
  if (routeKind === 'shuttle-history') return <section className="workspace-page"><ShuttleHistoryPage shuttleId={routeParams.shuttleId || ''} notify={notify} onBack={() => navigate('/trip-history')} /></section>
  if (routeKind === 'trip-detail') return <section className="workspace-page"><TripHistoryPage notify={notify} tripId={routeParams.tripId} onClearShuttle={() => navigate('/trip-history')} onSelectTrip={(nextId) => navigate(`/trip-history/${nextId}`)} /></section>
  if (routeKind === 'route-detail' && routeParams.mode === 'new') return <RouteCreatePage notify={notify} onSaved={() => { onChanged(); navigate('/routes') }} onCancel={() => navigate('/routes')} />
  if (routeKind === 'route-detail' && routeParams.mode === 'edit') return <RouteEditPage routeId={routeParams.routeId || 'unknown'} notify={notify} onSaved={() => { onChanged(); navigate(`/routes/${routeParams.routeId || ''}`) }} onCancel={() => navigate('/routes')} />
  if (routeKind === 'route-detail') return <RouteDetailPage routeId={routeParams.routeId || 'unknown'} />
  if (routeKind === 'alert-detail') return <AlertDetailPage alertId={routeParams.alertId || 'unknown'} />
  if (routeKind === 'not-found') return <ModulePageFrame title="Page not found" description="The requested Trackline page does not exist." />

  return <section className="workspace-page">
    <div className="page-heading workspace-page-heading">
      <div><div className="eyebrow"><span className="pulse-dot" /> TRACKLINE WORKSPACE</div><h1>{section}</h1><p>{descriptions[section] ?? 'Manage your campus transit workspace.'}</p></div>
      {/* <button className="primary-button" onClick={() => notify(`${section} view is ready`)}><Sparkles size={16} /> Quick action</button> */}
    </div>

    {section === 'Driver GPS' ? <DriverTracking shuttles={apiShuttles || []} routes={routes} notify={notify} user={user} /> : section === 'GPS Test Run' ? <GpsTestRunPage routes={routes} shuttles={apiShuttles || []} notify={notify} /> : ['Stops', 'Drivers', 'Assignments', 'Schedules'].includes(section) ? <MaintenanceManager kind={section as 'Stops' | 'Drivers' | 'Assignments' | 'Schedules'} routes={routes} shuttles={apiShuttles || []} notify={notify} onChanged={onChanged} /> : section === 'Users & roles' ? <UsersPage notify={notify} onChanged={onChanged} /> : section === 'Profile' ? <ProfilePage user={user} notify={notify} onUpdated={onProfileUpdated} /> : section === 'Settings' ? <SettingsPage theme={theme} setTheme={setTheme} settings={settings} systemSettings={systemSettings} notify={notify} onChanged={onChanged} /> : section === 'Routes' ? <RoutesPage navigate={navigate} routes={routes} notify={notify} onChanged={onChanged} /> : section === 'Shuttles' ? <ShuttlesPage navigate={navigate} shuttles={shuttles} routes={routes} notify={notify} onChanged={onChanged} onOpenHistory={onOpenShuttleHistory} /> : section === 'Trip history' ? <TripHistoryPage notify={notify} shuttleId={historyShuttleId} onClearShuttle={onClearShuttleHistory} /> : section === 'Alerts' ? <AlertsPanel user={user} notify={notify} onUnreadChange={onUnreadChange} /> : <div className="resource-grid">{getWorkspaceCards(section, routes, stops, shuttles).map((card) => <button className="resource-card" key={card.title} onClick={() => notify(`${card.title} selected`)}><div className={`resource-icon ${card.tone}`}>{card.icon}</div><div className="resource-copy"><strong>{card.title}</strong><span>{card.subtitle}</span></div><div className="resource-value">{card.value}</div><ChevronDown size={16} className="row-chevron" /></button>)}</div>}
  </section>
}

function getWorkspaceCards(section: string, routes: ApiRoute[], stops: ApiStop[], shuttles: ShuttleSummary[]) {
  if (section === 'Routes' && routes.length) return routes.map((route, index) => ({ title: route.name, subtitle: `${route.stop_count} pickup stops · ${route.description || 'Database route'}`, value: route.status === 'ACTIVE' ? 'LIVE' : 'OFFLINE', tone: ['blue', 'green', 'yellow'][index % 3], icon: <Route size={18} /> }))
  if (section === 'Stops' && stops.length) return stops.map((stop, index) => ({ title: stop.name, subtitle: `GPS ${Number(stop.latitude).toFixed(4)}, ${Number(stop.longitude).toFixed(4)}`, value: `${stop.geofence_radius} m`, tone: ['yellow', 'blue', 'green', 'purple'][index % 4], icon: <MapPin size={18} /> }))
  if (section === 'Shuttles' && shuttles.length) return shuttles.map((shuttle, index) => ({ title: shuttle.id, subtitle: `${shuttle.route} · ${shuttle.driver}`, value: shuttle.status === 'On route' ? 'LIVE' : shuttle.status.toUpperCase(), tone: ['blue', 'green', 'yellow'][index % 3], icon: <BusFront size={18} /> }))
  return []
}
