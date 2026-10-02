import React, { useRef, useState } from 'react'
import { BriefcaseBusiness, CalendarDays, Camera, Check, Eye, EyeOff, LockKeyhole, Mail, Phone, Save, ShieldCheck, UserRound } from 'lucide-react'
import { api, type SessionUser } from '../../api'

export default function ProfilePage({ user, notify, onUpdated }: { user: SessionUser; notify: (message: string) => void; onUpdated: (user: SessionUser, token: string) => void }) {
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [avatarData, setAvatarData] = useState(user.avatar_data || '')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeProfileSection, setActiveProfileSection] = useState<'profile-personal' | 'profile-password'>('profile-personal')
  const photoInputRef = useRef<HTMLInputElement>(null)

  const roleLabel = user.role === 'ADMIN' ? 'Administrator' : user.role === 'DRIVER' ? 'Driver' : user.role === 'MAIN_GATE' ? 'Main Gate' : 'Employee'
  const initials = user.name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'TA'

  const readProfilePhoto = (file: File) => new Promise<string>((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Choose an image file.'))
    if (file.size > 8 * 1024 * 1024) return reject(new Error('Profile photo must be smaller than 8 MB.'))
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read the selected photo.'))
    reader.onload = () => {
      const image = new Image()
      image.onerror = () => reject(new Error('Could not process the selected photo.'))
      image.onload = () => {
        const maxSize = 512
        const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
        canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', .86))
      }
      image.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      setAvatarData(await readProfilePhoto(file))
      notify('Profile photo selected. Click Save profile to upload it.')
    } catch (error) { notify(error instanceof Error ? error.message : 'Could not select profile photo') }
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (newPassword && !currentPassword) return notify('Enter your current password before setting a new password.')
    if (newPassword && newPassword !== confirmPassword) return notify('New password and confirmation do not match.')
    if (newPassword && newPassword.length < 6) return notify('New password must be at least 6 characters.')
    setSaving(true)
    try {
      const result = await api.updateProfile({ name, email, currentPassword: currentPassword || undefined, newPassword: newPassword || undefined, avatarData: avatarData || null })
      onUpdated(result.user, result.token)
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
      notify('Profile updated in database')
    } catch (error) { notify(error instanceof Error ? error.message : 'Could not update profile') } finally { setSaving(false) }
  }

  const resetForm = () => {
    setName(user.name)
    setEmail(user.email)
    setAvatarData(user.avatar_data || '')
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  const scrollToSection = (id: 'profile-personal' | 'profile-password') => {
    setActiveProfileSection(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const passwordToggle = (visible: boolean, setVisible: (value: boolean) => void, label: string) => <button type="button" className="profile-v2-eye" onClick={() => setVisible(!visible)} aria-label={visible ? `Hide ${label}` : `Show ${label}`}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button>
  const passwordField = (label: string, value: string, setValue: (value: string) => void, visible: boolean, setVisible: (value: boolean) => void, autoComplete: string, placeholder?: string) => <label className="profile-v2-field"><span>{label}</span><span className="profile-v2-input-wrap"><LockKeyhole size={17} /><input type={visible ? 'text' : 'password'} value={value} onChange={(event) => setValue(event.target.value)} autoComplete={autoComplete} placeholder={placeholder} minLength={6} />{passwordToggle(visible, setVisible, label.toLowerCase())}</span></label>

  return <div className="profile-v2">
    {/* <div className="profile-v2-heading"><div><span className="profile-v2-eyebrow"><i /> TRACKLINE WORKSPACE</span><h2>Profile</h2><p>Update your account details and password.</p></div><button className="primary-button profile-v2-quick" type="button" onClick={() => notify('Profile actions are available below')}><Sparkles size={16} /> Quick action</button></div> */}
    <section className="profile-v2-identity">
      <div className="profile-v2-avatar">{avatarData ? <img src={avatarData} alt="Profile" /> : initials}<button type="button" aria-label="Change profile photo" onClick={() => photoInputRef.current?.click()}><Camera size={17} /></button><input ref={photoInputRef} className="profile-v2-file-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhotoChange} /></div>
      <div className="profile-v2-identity-copy"><div className="profile-v2-name-row"><h3>{user.name}</h3><span>{user.role}</span></div><p><Mail size={16} />{user.email}</p><p><BriefcaseBusiness size={16} />Trackline Workspace</p></div>
      <div className="profile-v2-meta"><div><ShieldCheck size={22} /><span>Account Type<strong>{roleLabel}</strong></span></div><div><CalendarDays size={22} /><span>Member Since<strong>Oct 1, 2026</strong></span></div><div><i className="profile-v2-status-dot" /><span>Account Status<strong>Active</strong></span></div></div>
    </section>
    <div className="profile-v2-body">
      <aside className="profile-v2-nav"><button type="button" className={activeProfileSection === 'profile-personal' ? 'active' : ''} aria-pressed={activeProfileSection === 'profile-personal'} onClick={() => scrollToSection('profile-personal')}><UserRound size={21} /><span>Personal Information<small>Update your basic details</small></span></button><button type="button" className={activeProfileSection === 'profile-password' ? 'active' : ''} aria-pressed={activeProfileSection === 'profile-password'} onClick={() => scrollToSection('profile-password')}><LockKeyhole size={21} /><span>Change Password<small>Keep your account secure</small></span></button></aside>
      <form className="profile-v2-form" onSubmit={save}>
        <section className="profile-v2-section" id="profile-personal"><div className="profile-v2-section-heading"><span className="profile-v2-section-icon"><UserRound size={21} /></span><div><h3>Personal Information</h3><p>Update your personal details. This information will be used across the system.</p></div></div><div className="profile-v2-fields"><label className="profile-v2-field"><span>Full name <b>*</b></span><span className="profile-v2-input-wrap"><UserRound size={17} /><input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required /></span></label><label className="profile-v2-field"><span>Email address <b>*</b></span><span className="profile-v2-input-wrap"><Mail size={17} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></span></label><label className="profile-v2-field"><span>Phone number</span><span className="profile-v2-input-wrap"><Phone size={17} /><input placeholder="Enter your phone number" /></span></label><label className="profile-v2-field"><span>Position / Role</span><span className="profile-v2-input-wrap"><BriefcaseBusiness size={17} /><input value={roleLabel} readOnly /></span></label></div></section>
        <div className="profile-v2-divider" />
        <section className="profile-v2-section" id="profile-password"><div className="profile-v2-section-heading"><span className="profile-v2-section-icon"><LockKeyhole size={21} /></span><div><h3>Change Password</h3><p>Leave these fields blank if you do not want to change your password.</p></div></div><div className="profile-v2-password-fields">{passwordField('Current password', currentPassword, setCurrentPassword, showCurrentPassword, setShowCurrentPassword, 'current-password')}{passwordField('New password', newPassword, setNewPassword, showNewPassword, setShowNewPassword, 'new-password', 'Minimum 6 characters')}{passwordField('Confirm new password', confirmPassword, setConfirmPassword, showConfirmPassword, setShowConfirmPassword, 'new-password', 'Confirm new password')}</div><div className="profile-v2-requirements"><strong><ShieldCheck size={20} />Password requirements</strong><div><span><Check size={16} />At least 6 characters</span><span><Check size={16} />Include letters and numbers</span><span><Check size={16} />Avoid using personal information</span></div></div></section>
        <div className="profile-v2-actions"><button type="button" className="secondary-button" onClick={resetForm}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving…' : <><Save size={16} /> Save profile</>}</button></div>
      </form>
    </div>
  </div>
}
