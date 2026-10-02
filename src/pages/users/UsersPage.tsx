import React, { useEffect, useMemo, useState } from 'react'
import { Plus, Search, ShieldCheck } from 'lucide-react'
import { api, type ApiUser } from '../../api'
import { PaginationControls, usePagination } from '../../Pagination'

export default function UsersPage({ notify, onChanged }: { notify: (message: string) => void; onChanged: () => void }) {
  const blank = { employeeNumber: '', name: '', email: '', password: '', role: 'USER', driverId: '', isActive: true }
  const [users, setUsers] = useState<ApiUser[]>([])
  const [drivers, setDrivers] = useState<Array<{ id: number; driver_name: string; employee_number: string; is_active: number }>>([])
  const [editing, setEditing] = useState<ApiUser | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return users
    return users.filter((user) => [user.name, user.email, user.employee_number, user.role, user.driver_name].filter(Boolean).some((value) => String(value).toLowerCase().includes(query)))
  }, [users, search])
  const pagination = usePagination(filteredUsers, 8)
  const load = async () => { try { const [userResult, driverResult] = await Promise.all([api.users(), api.drivers()]); setUsers(userResult.users); setDrivers(driverResult.drivers) } catch (error) { notify(error instanceof Error ? error.message : 'Could not load users') } }
  useEffect(() => { void load() }, [])
  const openForm = (user?: ApiUser) => { setFormOpen(true); setEditing(user || null); setForm(user ? { employeeNumber: user.employee_number || '', name: user.name, email: user.email, password: '', role: user.role, driverId: user.driver_id ? String(user.driver_id) : '', isActive: user.is_active !== 0 } : { ...blank }) }
  const closeForm = () => { setFormOpen(false); setEditing(null); setForm({ ...blank }) }
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true)
    try {
      const payload = { employeeNumber: form.employeeNumber, name: form.name, email: form.email, password: form.password || undefined, role: form.role, driverId: form.role === 'DRIVER' && form.driverId ? Number(form.driverId) : null, isActive: form.isActive }
      const result = editing ? await api.updateUser(editing.id, payload) : await api.createUser(payload)
      setUsers((current) => editing ? current.map((user) => user.id === result.user.id ? { ...user, ...result.user } : user) : [result.user, ...current])
      notify(editing ? 'User updated in database' : 'User created in database'); closeForm(); onChanged()
    } catch (error) { notify(error instanceof Error ? error.message : 'Could not save user') } finally { setSaving(false) }
  }
  const deactivate = async (user: ApiUser) => { if (!window.confirm(`Permanently delete ${user.email}? This cannot be undone.`)) return; try { await api.permanentlyDeleteUser(user.id); setUsers((current) => current.filter((item) => item.id !== user.id)); notify('User permanently deleted'); onChanged() } catch (error) { notify(error instanceof Error ? error.message : 'Could not permanently delete user') } }
  return <div className="crud-page"><div className="crud-toolbar"><div><h3>Users &amp; roles</h3><span>{search ? `${filteredUsers.length} matching accounts` : `${users.length} accounts stored in MariaDB`} · admin only</span></div><label className="crud-search"><Search size={15} /><input value={search} onChange={(event) => { setSearch(event.target.value); pagination.setPage(0) }} placeholder="Search users..." aria-label="Search users" /></label><button className="primary-button compact" onClick={() => openForm()}><Plus size={14} /> Add user</button></div>{formOpen && <form className="crud-form" onSubmit={save}><div className="crud-form-heading"><strong>{editing ? 'Edit user' : 'New user account'}</strong><button type="button" className="close-small" onClick={closeForm}>×</button></div><div className="crud-form-grid"><label>Employee number<input value={form.employeeNumber} onChange={(event) => setForm({ ...form, employeeNumber: event.target.value.toUpperCase() })} placeholder="A288378" required={form.role === 'USER'} /></label><label>Full name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Juan Dela Cruz" required /></label><label>Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="employee@tdk.com" required /></label><label>Password{editing && <small>Leave blank to keep current password</small>}<input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={editing ? 'Keep current password' : 'Minimum 6 characters'} required={!editing} minLength={6} /></label><label>Role<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value, driverId: event.target.value === 'DRIVER' ? form.driverId : '' })}><option value="USER">USER / Employee</option><option value="DRIVER">DRIVER</option><option value="MAIN_GATE">MAIN_GATE / Security</option><option value="ADMIN">ADMIN</option></select></label>{form.role === 'DRIVER' && <label>Linked driver<select value={form.driverId} onChange={(event) => setForm({ ...form, driverId: event.target.value })} required><option value="">Choose driver</option>{drivers.filter((driver) => driver.is_active !== 0).map((driver) => <option key={driver.id} value={driver.id}>{driver.employee_number} · {driver.driver_name}</option>)}</select></label>}{editing && <label>Account status<select value={form.isActive ? 'ACTIVE' : 'INACTIVE'} onChange={(event) => setForm({ ...form, isActive: event.target.value === 'ACTIVE' })}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>}</div><div className="crud-form-actions"><button type="button" className="secondary-button compact" onClick={closeForm}>Cancel</button><button type="submit" className="primary-button compact" disabled={saving}>{saving ? 'Saving…' : 'Save user'}</button></div></form>}<div className="crud-list">{pagination.visibleItems.length ? pagination.visibleItems.map((user) => <div className="crud-row" key={user.id}><div className="resource-icon purple"><ShieldCheck size={17} /></div><div className="crud-main"><strong>{user.name}</strong><span>{user.employee_number ? `${user.employee_number} · ` : ''}{user.email} · {user.role}{user.driver_name ? ` · ${user.driver_name}` : ''}</span></div><span className={`setting-status ${user.is_active !== 0 ? 'live' : ''}`}><i />{user.is_active !== 0 ? 'ACTIVE' : 'INACTIVE'}</span><button className="crud-action" onClick={() => openForm(user)}>Edit</button>{user.is_active !== 0 && <button className="crud-action danger-text" onClick={() => deactivate(user)}>Deactivate</button>}</div>) : <div className="crud-empty">No users match your search.</div>}</div><PaginationControls {...pagination} setPage={pagination.setPage} /></div>
}
