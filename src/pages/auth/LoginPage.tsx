import React, { useEffect, useState } from 'react'
import { Navigation, ShieldCheck } from 'lucide-react'

export default function LoginPage({ onLogin, error }: { onLogin: (email: string, password: string) => Promise<void>; error: string }) {
  const [email, setEmail] = useState('admin@trackline.local')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [theme] = useState<'dark' | 'light'>(() => window.localStorage.getItem('trackline-theme') === 'light' ? 'light' : 'dark')

  useEffect(() => {
    document.body.classList.toggle('auth-light', theme === 'light')
    return () => document.body.classList.remove('auth-light')
  }, [theme])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    await onLogin(email, password)
    setSubmitting(false)
  }

  return <main className="auth-screen"><div className="auth-card"><div className="auth-brand"><div className="brand-mark"><Navigation size={18} strokeWidth={2.8} /></div><div><strong>trackline</strong><span>CAMPUS TRANSIT</span></div></div><div className="auth-heading"><span className="eyebrow"><span className="pulse-dot" /> SECURE OPERATIONS PORTAL</span><h1>Welcome back</h1><p>Sign in to manage your campus shuttle network.</p></div><form onSubmit={submit} className="login-form"><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="Enter your password" required /></label>{error && <div className="auth-error">{error}</div>}<button className="primary-button auth-submit" type="submit" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in to Trackline'}<Navigation size={16} /></button></form><div className="auth-footer"><ShieldCheck size={15} /> Your session is protected with JWT authentication</div></div></main>
}
