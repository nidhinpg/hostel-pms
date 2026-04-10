import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function StaffManager({ propertyId }) {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState('list') // list | create | link
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [toast, setToast] = useState('')
  const [creating, setCreating] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('profiles').select('*')
      .eq('role', 'staff').eq('property_id', propertyId)
    setStaff(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [propertyId])

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 4000) }

  // Step 1: Owner creates staff account via Supabase signup flow
  // We use signUp which works from frontend, then immediately sign back in as owner
  const handleCreateStaff = async () => {
    if (!form.name || !form.email || !form.password) { showToast('Fill all fields'); return }
    if (form.password.length < 6) { showToast('Password must be at least 6 characters'); return }
    setCreating(true)

    // Save current owner session
    const { data: { session: ownerSession } } = await supabase.auth.getSession()

    // Sign up new staff user
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
      // Create/update their profile as staff
      await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: form.name,
        role: 'staff',
        property_id: propertyId,
        is_admin: false
      })
    }

    // Restore owner session
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
            staff.map(s => (
              <div key={s.id} className="card" style={{ marginBottom: 12 }}>
                <div className="row-between">
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
                <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, fontSize: 13 }}>
                  <div style={{ color: 'var(--text-secondary)', marginBottom: 6 }}>Staff can:</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    {['View dashboard', 'View bed map', 'Collect rent', 'Add income & expenses'].map(item => (
                      <span key={item} className="badge badge-green" style={{ fontSize: 11 }}>✓ {item}</span>
                    ))}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', marginBottom: 6 }}>Staff cannot:</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {['Delete entries', 'Add/remove tenants', 'Add/delete beds', 'View reports'].map(item => (
                      <span key={item} className="badge badge-red" style={{ fontSize: 11 }}>✗ {item}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))
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
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--blue-bg)', color: 'var(--blue)', padding: '10px 12px', borderRadius: 6 }}>
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
