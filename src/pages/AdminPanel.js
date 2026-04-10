import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'

const PLAN_TYPES = ['trial', 'basic', 'pro', 'owned']

export default function AdminPanel() {
  const [owners, setOwners] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddOwner, setShowAddOwner] = useState(false)
  const [showAddProperty, setShowAddProperty] = useState(false)
  const [selectedOwner, setSelectedOwner] = useState(null)
  const [toast, setToast] = useState('')
  const [ownerForm, setOwnerForm] = useState({ email: '', password: '', full_name: '' })
  const [propForm, setPropForm] = useState({
    name: '', address: '', city: '',
    plan_type: 'trial', subscription_status: 'active',
    trial_end_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  })

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const load = useCallback(async () => {
    const { data: profiles } = await supabase.from('profiles').select('*').order('created_at')
    const { data: props } = await supabase.from('properties').select('*').order('created_at')

    const combined = (profiles || []).map(p => ({
      ...p,
      properties: (props || []).filter(pr => pr.owner_id === p.id)
    }))
    setOwners(combined)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleAddOwner = async () => {
    if (!ownerForm.email || !ownerForm.password || !ownerForm.full_name) {
      showToast('Fill all fields'); return
    }
    // Create user via Supabase admin
    const { data, error } = await supabase.auth.admin.createUser({
      email: ownerForm.email,
      password: ownerForm.password,
      email_confirm: true,
      user_metadata: { full_name: ownerForm.full_name }
    })
    if (error) { showToast('Error: ' + error.message); return }

    // Create profile
    await supabase.from('profiles').insert({
      id: data.user.id,
      full_name: ownerForm.full_name,
      is_admin: false
    })

    showToast('Owner created! Now add a property for them.')
    setShowAddOwner(false)
    setOwnerForm({ email: '', password: '', full_name: '' })
    load()
  }

  const handleAddProperty = async () => {
    if (!propForm.name || !selectedOwner) { showToast('Fill property name'); return }
    const { error } = await supabase.from('properties').insert({
      owner_id: selectedOwner.id,
      ...propForm
    })
    if (error) { showToast('Error: ' + error.message); return }
    showToast('Property added!')
    setShowAddProperty(false)
    setPropForm({ name: '', address: '', city: '', plan_type: 'trial', subscription_status: 'active', trial_end_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) })
    load()
  }

  const handleUpdatePlan = async (propertyId, plan_type, subscription_status) => {
    await supabase.from('properties').update({ plan_type, subscription_status }).eq('id', propertyId)
    showToast('Plan updated')
    load()
  }

  const of = k => e => setOwnerForm(p => ({ ...p, [k]: e.target.value }))
  const pf = k => e => setPropForm(p => ({ ...p, [k]: e.target.value }))

  const planColor = (plan) => {
    if (plan === 'owned') return 'badge-blue'
    if (plan === 'pro') return 'badge-green'
    if (plan === 'basic') return 'badge-amber'
    return 'badge-red'
  }

  if (loading) return <div className="loading">Loading admin panel...</div>

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Admin panel</h1>
        <button className="btn btn-primary" onClick={() => setShowAddOwner(true)}>+ Add owner</button>
      </div>

      <div className="metrics" style={{ marginBottom: 24 }}>
        <div className="metric">
          <div className="metric-label">Total owners</div>
          <div className="metric-value">{owners.filter(o => !o.is_admin).length}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Total properties</div>
          <div className="metric-value">{owners.reduce((a, o) => a + o.properties.length, 0)}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Active subscriptions</div>
          <div className="metric-value" style={{ color: 'var(--green)' }}>
            {owners.reduce((a, o) => a + o.properties.filter(p => p.subscription_status === 'active').length, 0)}
          </div>
        </div>
        <div className="metric">
          <div className="metric-label">Trial accounts</div>
          <div className="metric-value" style={{ color: 'var(--amber)' }}>
            {owners.reduce((a, o) => a + o.properties.filter(p => p.plan_type === 'trial').length, 0)}
          </div>
        </div>
      </div>

      {owners.map(owner => (
        <div key={owner.id} className="card" style={{ marginBottom: 12 }}>
          <div className="row-between" style={{ marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{owner.full_name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{owner.id}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {owner.is_admin && <span className="badge badge-blue">Admin</span>}
              <button className="btn" style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => { setSelectedOwner(owner); setShowAddProperty(true) }}>
                + Property
              </button>
            </div>
          </div>

          {owner.properties.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No properties yet</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {owner.properties.map(prop => (
                <div key={prop.id} style={{
                  background: 'var(--bg)', borderRadius: 8,
                  padding: '10px 14px', display: 'flex',
                  alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8
                }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{prop.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {prop.city} · Trial ends: {prop.trial_end_date || '—'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className={`badge ${planColor(prop.plan_type)}`}>{prop.plan_type}</span>
                    <span className={`badge ${prop.subscription_status === 'active' ? 'badge-green' : 'badge-red'}`}>
                      {prop.subscription_status}
                    </span>
                    <select
                      value={prop.plan_type}
                      onChange={e => handleUpdatePlan(prop.id, e.target.value, prop.subscription_status)}
                      style={{ fontSize: 12, padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 4, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text)' }}>
                      {PLAN_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <select
                      value={prop.subscription_status}
                      onChange={e => handleUpdatePlan(prop.id, prop.plan_type, e.target.value)}
                      style={{ fontSize: 12, padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 4, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text)' }}>
                      <option value="active">active</option>
                      <option value="expired">expired</option>
                      <option value="suspended">suspended</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Add Owner Modal */}
      {showAddOwner && (
        <Modal title="Add new owner" onClose={() => setShowAddOwner(false)}
          footer={
            <>
              <button className="btn" onClick={() => setShowAddOwner(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddOwner}>Create owner</button>
            </>
          }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-group"><label>Full name</label><input placeholder="John Mathew" value={ownerForm.full_name} onChange={of('full_name')} /></div>
            <div className="form-group"><label>Email</label><input type="email" placeholder="john@example.com" value={ownerForm.email} onChange={of('email')} /></div>
            <div className="form-group"><label>Temporary password</label><input type="password" placeholder="Min 6 characters" value={ownerForm.password} onChange={of('password')} /></div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg)', padding: '8px 12px', borderRadius: 6 }}>
              Owner will log in with these credentials. Share password securely.
            </div>
          </div>
        </Modal>
      )}

      {/* Add Property Modal */}
      {showAddProperty && selectedOwner && (
        <Modal title={`Add property for ${selectedOwner.full_name}`} onClose={() => setShowAddProperty(false)}
          footer={
            <>
              <button className="btn" onClick={() => setShowAddProperty(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddProperty}>Add property</button>
            </>
          }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-group"><label>Property name *</label><input placeholder="Sunrise Hostel" value={propForm.name} onChange={pf('name')} /></div>
            <div className="form-grid">
              <div className="form-group"><label>City</label><input placeholder="Kochi" value={propForm.city} onChange={pf('city')} /></div>
              <div className="form-group"><label>Plan</label>
                <select value={propForm.plan_type} onChange={pf('plan_type')}>
                  {PLAN_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group"><label>Address</label><input placeholder="Full address" value={propForm.address} onChange={pf('address')} /></div>
            <div className="form-grid">
              <div className="form-group"><label>Trial end date</label><input type="date" value={propForm.trial_end_date} onChange={pf('trial_end_date')} /></div>
              <div className="form-group"><label>Status</label>
                <select value={propForm.subscription_status} onChange={pf('subscription_status')}>
                  <option value="active">active</option>
                  <option value="expired">expired</option>
                  <option value="suspended">suspended</option>
                </select>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
