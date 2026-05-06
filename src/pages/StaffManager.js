import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const DEFAULT_PERMISSIONS = {
  view_dashboard: true,
  view_bedmap: true,
  collect_rent: true,
  add_expenses: true,
  add_tenants: false,
  delete_entries: false,
  add_beds: false,
  view_reports: false
}

const PERMISSION_LABELS = [
  { key: 'view_dashboard',  label: 'View dashboard',        icon: '📊' },
  { key: 'view_bedmap',     label: 'View bed map',          icon: '🛏' },
  { key: 'collect_rent',    label: 'Collect rent',          icon: '💰' },
  { key: 'add_expenses',    label: 'Add income & expenses', icon: '📝' },
  { key: 'add_tenants',     label: 'Add/remove tenants',    icon: '👤' },
  { key: 'add_beds',        label: 'Add/delete beds',       icon: '🛏' },
  { key: 'view_reports',    label: 'View reports',          icon: '📈' },
  { key: 'delete_entries',  label: 'Delete entries',        icon: '🗑' },
]

// Toggle switch component
function Toggle({ checked, onChange }) {
  return (
    <div
      onClick={onChange}
      style={{
        width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
        background: checked ? 'var(--green)' : 'var(--border-strong)',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0
      }}>
      <div style={{
        position: 'absolute', top: 3,
        left: checked ? 23 : 3,
        width: 18, height: 18, borderRadius: '50%',
        background: 'white', transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
      }} />
    </div>
  )
}

export default function StaffManager({ propertyId }) {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState('list')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [toast, setToast] = useState('')
  const [creating, setCreating] = useState(false)
  const [savingPerms, setSavingPerms] = useState({})

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('profiles').select('*')
      .eq('role', 'staff').eq('property_id', propertyId)
    setStaff(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [propertyId])

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const handleTogglePermission = async (staffId, key, currentPerms) => {
    const updated = {
      ...DEFAULT_PERMISSIONS,
      ...currentPerms,
      [key]: !currentPerms[key]
    }
    setSavingPerms(p => ({ ...p, [staffId]: true }))
    await supabase.from('profiles')
      .update({ permissions: updated })
      .eq('id', staffId)
    setSavingPerms(p => ({ ...p, [staffId]: false }))
    setStaff(prev => prev.map(s =>
      s.id === staffId ? { ...s, permissions: updated } : s
    ))
    showToast(`Permission updated`)
  }

  const handleCreateStaff = async () => {
    if (!form.name || !form.email || !form.password) { showToast('Fill all fields'); return }
    if (form.password.length < 6) { showToast('Password must be at least 6 characters'); return }
    setCreating(true)

    const { data: { session: ownerSession } } = await supabase.auth.getSession()

    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.name } }
    })

    if (error) {
      showToast('Error: ' + error.message)
      setCreating(false)
      return
    }

    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: form.name,
        role: 'staff',
        property_id: propertyId,
        is_admin: false,
        permissions: DEFAULT_PERMISSIONS
      })
    }

    if (ownerSession) {
      await supabase.auth.setSession({
        access_token: ownerSession.access_token,
        refresh_token: ownerSession.refresh_token
      })
    }

    showToast('Staff account created! They can now log in.')
    setStep('list')
    setForm({ name: '', email: '', password: '' })
    setCreating(false)
    load()
  }

  const handleRemove = async (staffId) => {
    if (!window.confirm('Remove this staff account?')) return
    await supabase.from('profiles')
      .update({ role: 'owner', property_id: null })
      .eq('id', staffId)
    showToast('Staff removed')
    load()
  }

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  if (loading) return <div className="loading">Loading...</div>

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Staff management</h1>
        {staff.length === 0 && step === 'list' && (
          <button className="btn btn-primary" onClick={() => setStep('create')}>+ Add staff</button>
        )}
      </div>

      {step === 'list' && (
        <>
          {staff.length === 0 ? (
            <div className="card">
              <div className="empty">
                No staff account yet.
                <span style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                  Add one staff member to help manage this property.
                </span>
              </div>
            </div>
          ) : (
            staff.map(s => {
              const perms = { ...DEFAULT_PERMISSIONS, ...(s.permissions || {}) }
              return (
                <div key={s.id} className="card" style={{ marginBottom: 12 }}>
                  {/* Header */}
                  <div className="row-between" style={{ marginBottom: 16 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{s.full_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Staff account</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className="badge badge-green">Active</span>
                      <button className="btn btn-danger" style={{ fontSize: 12, padding: '4px 10px' }}
                        onClick={() => handleRemove(s.id)}>Remove</button>
                    </div>
                  </div>

                  {/* Permission toggles */}
                  <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      Permissions {savingPerms[s.id] && <span style={{ color: 'var(--amber)', fontWeight: 400 }}>Saving...</span>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {PERMISSION_LABELS.map(({ key, label, icon }) => (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 15 }}>{icon}</span>
                            <span style={{ fontSize: 13, color: perms[key] ? 'var(--text)' : 'var(--text-secondary)' }}>{label}</span>
                          </div>
                          <Toggle
                            checked={perms[key]}
                            onChange={() => handleTogglePermission(s.id, key, perms)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </>
      )}

      {step === 'create' && (
        <div className="card" style={{ maxWidth: 460 }}>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>Create staff account</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-group">
              <label>Full name</label>
              <input placeholder="Staff name" value={form.name} onChange={f('name')} />
            </div>
            <div className="form-group">
              <label>Email address</label>
              <input type="email" placeholder="staff@example.com" value={form.email} onChange={f('email')} />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" placeholder="Min 6 characters" value={form.password} onChange={f('password')} />
            </div>
            <div style={{ fontSize: 12, padding: '10px 12px', borderRadius: 6, background: 'var(--blue-bg)', color: 'var(--blue)' }}>
              Staff will log in at the same URL with these credentials. Share them securely.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button className="btn" onClick={() => { setStep('list'); setForm({ name: '', email: '', password: '' }) }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateStaff} disabled={creating}>
                {creating ? 'Creating...' : 'Create staff account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
