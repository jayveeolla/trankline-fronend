import { useEffect, useState } from 'react'
import { Navigation } from 'lucide-react'
import Dashboard from './app/layout/Dashboard'
import MainGateDashboard from './pages/main-gate/MainGateDashboard'
import LoginPage from './pages/auth/LoginPage'
import { api, clearSession, saveSession, type SessionUser } from './api'
import { closeRealtimeSocket, refreshRealtimeAuth } from './realtime'
import './app/layout/layout-overrides.css'

function App() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    const token = window.localStorage.getItem('trackline-token')
    if (!token || token.length > 8192) {
      if (token) window.localStorage.removeItem('trackline-token')
      setAuthLoading(false)
      return
    }
    api.me().then((result) => {
      if (result.user.role === 'MAIN_GATE' && !window.location.pathname.startsWith('/main-gate')) window.history.replaceState({}, '', '/main-gate')
      setUser(result.user)
    }).catch(() => clearSession()).finally(() => setAuthLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    setAuthError('')
    try {
      const result = await api.login(email, password)
      saveSession(result.token)
      refreshRealtimeAuth()
      if (result.user.role === 'MAIN_GATE') window.history.replaceState({}, '', '/main-gate')
      setUser(result.user)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to log in.')
    }
  }

  if (authLoading) return <div className="auth-loading"><div className="brand-mark"><Navigation size={18} /></div><strong>Loading Trackline…</strong><span>Checking your secure session</span></div>
  if (!user) return <LoginPage onLogin={login} error={authError} />
  if (user.role === 'MAIN_GATE') return <MainGateDashboard user={user} onLogout={() => { clearSession(); closeRealtimeSocket(); setUser(null) }} onProfileUpdated={(updatedUser, token) => { saveSession(token); refreshRealtimeAuth(); setUser(updatedUser) }} />
  return <Dashboard user={user} onLogout={() => { clearSession(); closeRealtimeSocket(); setUser(null) }} onProfileUpdated={(updatedUser, token) => { saveSession(token); refreshRealtimeAuth(); setUser(updatedUser) }} />
}

export default App
