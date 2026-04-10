import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function StaffManager({ propertyId }) {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [toast, setToast] = useState('')

  const load = async () => {
    const { data } = await supabase
      .from('profiles').select('*')
      .eq('role', 'staff').eq('property_id', propertyId)
    setStaff(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [propertyId])

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const handleAdd = async () => {
    if (!form.name || !form.email || !form.password) { showToast('Fill all fields'); return }
    const { data, error } = await supabase.auth.admin.createUser({
      email: form.email, password: form.password,
      email_confirm: true,
      user_metadata: { full_name: form.name }
    })
    if (error) { showToast('Error: ' + error.message); return }
    await supabase.from('profiles').upsert({
      id: data.user.id, full_name: form.name,
      role: 'staff', property_id: propertyId, is_admin: false
    })
    showToast('Staff account created!')
    setShowAdd(false)
    setForm({ name: '', email: '', password: '' })
    load()
  }

  const handleRemove = async (staffId) => {
    if (!window.confirm('Remove this staff account?')) return
    await supabase.from('profiles').update({ role: 'owner', property_id: null }).eq('id', staffId)
    showToast('Staff removed')
    load()
  }

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Staff management</h1>
        {staff.length === 0 && (
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add staff</button>
        )}
      </div>

      {loading ? <div className="loading">Loading...</div> : (
        <>
          {staff.length === 0 ? (
            <div className="card">
              <div className="empty">
                No staff account yet.<br />
                <span style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                  You can add one staff member for this property.
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

      {showAdd && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Add staff account</span>
              <button className="modal-close" onClick={() => setShowAdd(false)}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group"><label>Full name</label><input placeholder="Staff name" value={form.name} onChange={f('name')} /></div>
              <div className="form-group"><label>Email</label><input type="email" placeholder="staff@example.com" value={form.email} onChange={f('email')} /></div>
              <div className="form-group"><label>Password</label><input type="password" placeholder="Min 6 characters" value={form.password} onChange={f('password')} /></div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg)', padding: '8px 12px', borderRadius: 6 }}>
                Staff can add income/expenses and collect rent, but cannot delete entries or manage tenants/beds.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAdd}>Create staff</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
