import React, { useMemo, useState } from 'react'
import { Plus, Route, Search } from 'lucide-react'
import { api, type ApiRoute } from '../../api'
import RouteEditor from '../../RouteEditor'
import { PaginationControls, usePagination } from '../../Pagination'

export default function RoutesPage({ routes, notify, onChanged, navigate }: { routes: ApiRoute[]; notify: (message: string) => void; onChanged: () => void; navigate: (path: string) => void }) {
  const [editing, setEditing] = useState<ApiRoute | null>(null)
  const [builderOpen, setBuilderOpen] = useState(false)
  const [builderRoute, setBuilderRoute] = useState<ApiRoute | null>(null)
  const [form, setForm] = useState({ name: '', description: '', status: 'ACTIVE' })
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const filteredRoutes = useMemo(() => {
    const query = search.trim().toLowerCase()
    return routes.filter((route) => {
      const matchesSearch = !query || [route.name, route.route_name, route.route_code, route.description].filter(Boolean).some((value) => String(value).toLowerCase().includes(query))
      const matchesStatus = statusFilter === 'ALL' || route.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [routes, search, statusFilter])
  const pagination = usePagination(filteredRoutes, 8)
  if (builderOpen) return <div><button className="secondary-button compact" onClick={() => { setBuilderOpen(false); setBuilderRoute(null) }}>← Back to routes</button><div style={{ height: 12 }} /><RouteEditor route={builderRoute} notify={notify} onSaved={() => { setBuilderOpen(false); setBuilderRoute(null); onChanged() }} onCancel={() => { setBuilderOpen(false); setBuilderRoute(null) }} /></div>
  const openForm = (route?: ApiRoute) => { if (route) navigate(`/routes/${route.id}/edit`); else navigate('/routes/new') }
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true)
    try {
      if (editing) await api.updateRoute(editing.id, form)
      else await api.createRoute({ name: form.name, description: form.description })
      notify(editing ? 'Route updated in database' : 'Route added to database'); setEditing(null); onChanged()
    } catch (error) { notify(error instanceof Error ? error.message : 'Could not save route') } finally { setSaving(false) }
  }
  const remove = async (route: ApiRoute) => {
    if (!window.confirm(`Permanently delete ${route.name}? This cannot be undone.`)) return
    try { await api.permanentlyDeleteRoute(route.id); notify('Route permanently deleted from database'); onChanged() } catch (error) { notify(error instanceof Error ? error.message : 'Could not permanently delete route') }
  }
  return <div className="crud-page"><div className="crud-toolbar"><div><h3>Routes in database</h3><span>{search || statusFilter !== 'ALL' ? `${filteredRoutes.length} matching routes` : `${routes.length} saved routes`} · changes sync immediately</span></div><div className="crud-filters"><label className="crud-search"><Search size={15} /><input value={search} onChange={(event) => { setSearch(event.target.value); pagination.setPage(0) }} placeholder="Search routes..." aria-label="Search routes" /></label><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); pagination.setPage(0) }} aria-label="Filter routes by status"><option value="ALL">All status</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></div><button className="primary-button compact" onClick={() => openForm()}><Plus size={14} /> Add route</button></div>{editing !== null || form.name !== '' ? <form className="crud-form" onSubmit={save}><div className="crud-form-heading"><strong>{editing ? 'Edit route' : 'New route'}</strong><button type="button" className="close-small" onClick={() => { setEditing(null); setForm({ name: '', description: '', status: 'ACTIVE' }) }}>×</button></div><label>Route name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Route A" required /></label><label>Description<input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Main campus loop" /></label>{editing && <label>Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>}<div className="crud-form-actions"><button type="button" className="secondary-button compact" onClick={() => { setEditing(null); setForm({ name: '', description: '', status: 'ACTIVE' }) }}>Cancel</button><button type="submit" className="primary-button compact" disabled={saving}>{saving ? 'Saving…' : 'Save route'}</button></div></form> : null}<div className="crud-list">{pagination.visibleItems.length ? pagination.visibleItems.map((route) => <div className="crud-row" key={route.id}><div className="resource-icon blue"><Route size={17} /></div><div className="crud-main"><strong>{route.name}</strong><span>{route.description || 'No description'} · {route.stop_count} stops</span></div><span className={`setting-status ${route.status === 'ACTIVE' ? 'live' : ''}`}><i />{route.status}</span><button className="crud-action" onClick={() => openForm(route)}>Edit</button><button className="crud-action danger-text" onClick={() => remove(route)}>Delete</button></div>) : <div className="crud-empty">No routes match your filters.</div>}</div><PaginationControls {...pagination} setPage={pagination.setPage} /></div>
}
