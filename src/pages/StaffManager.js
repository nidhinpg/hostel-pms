import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

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
  { key: 'add_expenses',    label: 'Receipts & payments',   icon: '📝' },
  { key: 'add_tenants',     label: 'Add/remove tenants',    icon: '👤' },
  { key: 'add_beds',        label: 'Add/delete beds',       icon: '🛏' },
  { key: 'view_reports',    label: 'View reports',          icon: '📈' },
  { key: 'delete_entries',  label: 'Delete entries',        icon: '🗑' },
]

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

export default function StaffManager({ propertyId, onUpgradeClick }) {
  const { properties, activeProperty, isAdmin } = useAuth()
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', property_id: propertyId || '' })
  const [toast, setToast] = useState('')
  const [creating, setCreating] = useState(false)
  const [savingPerms, setSavingPerms] = useState({})
  const [expandedStaff, setExpandedStaff] = useState(null)

  const load = async () => {
    setLoading(true)
    let query = supabase.from('profiles').select('*').eq('role', 'staff')

    // Admin sees all staff; owner sees only their property's staff
    if (!isAdmin && propertyId) {
      query = query.eq('property_id', propertyId)
    }

    const { data } = await query.order('created_at')
    setStaff(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [propertyId])

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const getPropertyName = (pid) => {
    const p = properties?.find(p => p.id === pid)
    return p?.name || pid
  }

  const handleTogglePermission = async (staffId, key, currentPerms) => {
    const updated = { ...DEFAULT_PERMISSIONS, ...currentPerms, [key]: !currentPerms[key] }
    setSavingPerms(p => ({ ...p, [staffId]: true }))

    // Use .select() so we get the updated row back and can verify the write actually happened
    const { data, error } = await supabase
      .from('profiles')
      .update({ permissions: updated })
      .eq('id', staffId)
      .select()

    setSavingPerms(p => ({ ...p, [staffId]: false }))

    if (error) {
      showToast('Error: ' + error.message)
      return
    }
    if (!data || data.length === 0) {
      // RLS silently blocked the update — 0 rows changed
      showToast('Save blocked by permissions. Check RLS policy.')
      return
    }

    // Only update local state if DB write actually succeeded
    setStaff(prev => prev.map(s => s.id === staffId ? { ...s, permissions: updated } : s))
    showToast('Permission updated')
  }

  const handleCreateStaff = async () => {
    if (!form.name || !form.email || !form.password) { showToast('Fill all fields'); return }
    if (!form.property_id) { showToast('Select a property'); return }
    if (form.password.length < 6) { showToast('Password must be at least 6 characters'); return }
    setCreating(true)

    const { data: { session: ownerSession } } = await supabase.auth.getSession()

    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.name } }
    })

    if (error) { showToast('Error: ' + error.message); setCreating(false); return }

    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: form.name,
        role: 'staff',
        property_id: form.property_id,
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

    showToast('Staff account created!')
    setShowCreate(false)
    setForm({ name: '', email: '', password: '', property_id: propertyId || '' })
    setCreating(false)
    load()
  }

  const handleRemove = async (staffId) => {
    if (!window.confirm('Remove this staff account?')) return
    await supabase.from('profiles').update({ role: 'owner', property_id: null }).eq('id', staffId)
    showToast('Staff removed')
    load()
  }

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  if (loading) return <div className="loading">Loading...</div>

  // Gate: Staff management is a Pro-only feature (admins bypass)
  const isPro = activeProperty?.plan_type === 'pro'
  if (!isAdmin && !isPro) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Staff management</h1>
        </div>
        <div className="card" style={{ maxWidth: 480, margin: '40px auto', textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
          <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>Staff logins are a Pro feature</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
            Your {activeProperty?.plan_type === 'basic' ? 'Basic' : 'Trial'} plan supports one owner login per property.
            Upgrade to Pro to add staff members and control what each one can see and do.
          </div>
          <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: 14, marginBottom: 20, textAlign: 'left' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>What Pro unlocks</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              ✓ Add staff logins with permission controls<br/>
              ✓ Unlimited properties<br/>
              ✓ Automatic WhatsApp rent reminders<br/>
              ✓ Push notifications for rent due
            </div>
          </div>
          {onUpgradeClick && (
            <button className="btn btn-primary" style={{ width: '100%', background: '#D85A30', border: 'none' }}
              onClick={onUpgradeClick}>
              ⚡ Upgrade to Pro
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Staff management</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Add staff</button>
      </div>

      {/* Staff list */}
      {staff.length === 0 ? (
        <div className="card">
          <div className="empty">
            No staff accounts yet.
            <span style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
              Add staff members to help manage your properties.
            </span>
          </div>
        </div>
      ) : (
        staff.map(s => {
          const perms = { ...DEFAULT_PERMISSIONS, ...(s.permissions || {}) }
          const isExpanded = expandedStaff === s.id
          return (
            <div key={s.id} className="card" style={{ marginBottom: 12 }}>
              {/* Header row */}
              <div className="row-between">
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{s.full_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {getPropertyName(s.property_id)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="badge badge-green">Active</span>
                  <button
                    className="btn"
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    onClick={() => setExpandedStaff(isExpanded ? null : s.id)}>
                    {isExpanded ? 'Hide' : 'Permissions'}
                  </button>
                  <button
                    className="btn btn-danger"
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    onClick={() => handleRemove(s.id)}>
                    Remove
                  </button>
                </div>
              </div>

              {/* Permission toggles — collapsible */}
              {isExpanded && (
                <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px 14px', marginTop: 16 }}>
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
                        <Toggle checked={perms[key]} onChange={() => handleTogglePermission(s.id, key, perms)} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })
      )}

      {/* Create staff modal */}
      {showCreate && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, padding: 20
        }} onClick={() => setShowCreate(false)}>
          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--radius)',
            padding: 24, minWidth: 320, maxWidth: 440, width: '100%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>Create staff account</div>
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
              <div className="form-group">
                <label>Assign to property</label>
                <select value={form.property_id} onChange={f('property_id')}
                  style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit' }}>
                  <option value="">Select property...</option>
                  {(properties || []).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ fontSize: 12, padding: '10px 12px', borderRadius: 6, background: 'var(--blue-bg)', color: 'var(--blue)' }}>
                Staff will log in at the same URL with these credentials. Share them securely.
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button className="btn" onClick={() => { setShowCreate(false); setForm({ name: '', email: '', password: '', property_id: propertyId || '' }) }}>Cancel</button>
                <button className="btn btn-primary" onClick={handleCreateStaff} disabled={creating}>
                  {creating ? 'Creating...' : 'Create staff account'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
