import React, { useEffect, useState } from 'react'
import { LocateFixed, Radio, Settings, Sun } from 'lucide-react'
import { api } from '../../api'

export default function SettingsPage({ theme, setTheme, settings, systemSettings, notify, onChanged }: { theme: 'dark' | 'light'; setTheme: (theme: 'dark' | 'light') => void; settings: Record<string, string>; systemSettings: Record<string, string>; notify: (message: string) => void; onChanged: () => void }) {
  return <div className="settings-panel">
      <div className="settings-row"><div className="settings-row-icon"><Sun size={18} /></div><div className="settings-copy"><strong>Appearance</strong><span>Choose the theme used across the dashboard.</span></div><button className="theme-switch" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><span className={theme === 'light' ? 'selected' : ''}>Light</span><span className={theme === 'dark' ? 'selected' : ''}>Dark</span></button></div>
      <div className="settings-row"><div className="settings-row-icon blue"><LocateFixed size={18} /></div><div className="settings-copy"><strong>Phone location</strong><span>Use your device GPS to sort nearby shuttles and center the map.</span></div><span className="setting-status live"><i /> Enabled in Live tracking</span></div>
      <div className="settings-row"><div className="settings-row-icon green"><Radio size={18} /></div><div className="settings-copy"><strong>Live shuttle updates</strong><span>Shuttle positions refresh automatically when a driver feed is active.</span></div><span className="setting-status live"><i /> Connected</span></div>
      <div className="settings-row"><div className="settings-row-icon blue"><Settings size={18} /></div><div className="settings-copy"><strong>Database service status</strong><span>{settings.service_status || 'Configured in MariaDB'} · {settings.campus_name || 'Trackline workspace'}</span></div><span className="setting-status live"><i /> Synced</span></div>
      <SettingsEditor settings={settings} notify={notify} onChanged={onChanged} />
       <SystemSettingsEditor settings={systemSettings} notify={notify} onChanged={onChanged} />
    </div>
}

function SettingsEditor({ settings, notify, onChanged }: { settings: Record<string, string>; notify: (message: string) => void; onChanged: () => void }) {
  const [key, setKey] = useState('service_status')
  const [value, setValue] = useState(settings.service_status || 'On time')
  const [saving, setSaving] = useState(false)
  useEffect(() => { setValue(settings[key] || '') }, [key, settings])
  const save = async (event: React.FormEvent) => { event.preventDefault(); setSaving(true); try { await api.updateSetting(key, value); notify('Setting saved in database'); onChanged() } catch (error) { notify(error instanceof Error ? error.message : 'Could not save setting') } finally { setSaving(false) } }
  return <form className="settings-editor" onSubmit={save}><div><strong>Edit database setting</strong><span>Changes are saved to the settings table.</span></div><select value={key} onChange={(event) => { setKey(event.target.value); setValue(settings[event.target.value] || '') }}><option value="service_status">service_status</option><option value="campus_name">campus_name</option><option value="offline_after_seconds">offline_after_seconds</option><option value="default_map_zoom">default_map_zoom</option></select><input value={value} onChange={(event) => setValue(event.target.value)} placeholder="Setting value" /><button className="primary-button compact" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save setting'}</button></form>
}

function SystemSettingsEditor({ settings, notify, onChanged }: { settings: Record<string, string>; notify: (message: string) => void; onChanged: () => void }) {
  const keys = ['TDK_NAME', 'TDK_LATITUDE', 'TDK_LONGITUDE', 'STOP_ARRIVAL_RADIUS_METERS', 'TDK_ARRIVAL_RADIUS_METERS', 'MINIMUM_GPS_ACCURACY', 'ARRIVAL_CONFIRMATION_COUNT', 'GPS_DELAYED_THRESHOLD', 'GPS_OFFLINE_THRESHOLD']
  const [key, setKey] = useState(keys[0])
  const [value, setValue] = useState(settings[key] || '')
  const [saving, setSaving] = useState(false)
  useEffect(() => { setValue(settings[key] || '') }, [key, settings])
  const save = async (event: React.FormEvent) => { event.preventDefault(); setSaving(true); try { await api.updateSystemSetting(key, value); notify('Operational setting saved in database'); onChanged() } catch (error) { notify(error instanceof Error ? error.message : 'Could not save operational setting') } finally { setSaving(false) } }
  return <form className="settings-editor system-settings-editor" onSubmit={save}><div><strong>GPS, geofence &amp; TDK settings</strong><span>Controls server-side arrival confirmation and the final TDK destination.</span></div><select value={key} onChange={(event) => { setKey(event.target.value); setValue(settings[event.target.value] || '') }}>{keys.map((settingKey) => <option key={settingKey} value={settingKey}>{settingKey}</option>)}</select><input value={value} onChange={(event) => setValue(event.target.value)} placeholder="Setting value" required /><button className="primary-button compact" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save operational setting'}</button></form>
}
