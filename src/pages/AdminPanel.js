import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'

const PLAN_TYPES = ['trial', 'pro']

export default function AdminPanel() {
  const [owners, setOwners] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddOwner, setShowAddOwner] = useState(false)
  const [selectedOwner, setSelectedOwner] = useState(null)
  const [showAddProperty, setShowAddProperty] = useState(false)
  const [toast, setToast] = useState('')
  const [creating, setCreating] = useState(false)

  const [form, setForm] = useState({
    full_name: '', email: '', password: '',
    prop_name: '', city: '', address: '',
    plan_type: 'trial', subscription_status: 'active',
    trial_end_date: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
    gpay_number: ''
  })

  const [propForm, setPropForm] = useState({
    name: '', address: '', city: '',
    plan_type: 'trial', subscription_status: 'active',
    trial_end_date: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
    gpay_number: ''
  })

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const load = useCallback(async () => {
    const { data: profiles } = await supabase.from('profiles').select('*').order('created_at')
    const { data: props } = await supabase.from('properties').select('*').order('created_at')
    const unique = (profiles || []).filter(p => p.role !== 'staff').filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i)
    const combined = unique.map(p => ({
      ...p,
      properties: (props || []).filter(pr => pr.owner_id === p.id)
    }))
    setOwners(combined)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))
  const pf = k => e => setPropForm(p => ({ ...p, [k]: e.target.value }))

  // One-shot: create owner + property + profile in one click
  const handleAddOwner = async () => {
    if (!form.full_name || !form.email || !form.password || !form.prop_name) {
      showToast('Fill all required fields'); return
    }
    if (form.password.length < 6) { showToast('Password min 6 characters'); return }
    setCreating(true)

    // Step 1: create auth user
    const { data, error } = await supabase.auth.admin.createUser({
      email: form.email,
      password: form.password,
      email_confirm: true,
      user_metadata: { full_name: form.full_name }
    })
    if (error) { showToast('Error: ' + error.message); setCreating(false); return }

    const userId = data.user.id

    // Step 2: create property
    const { data: prop, error: propErr } = await supabase.from('properties').insert({
      owner_id: userId,
      name: form.prop_name,
      city: form.city,
      address: form.address,
      plan_type: form.plan_type,
      subscription_status: form.subscription_status,
      trial_end_date: form.trial_end_date,
      gpay_number: form.gpay_number || null
    }).select().single()

    if (propErr) { showToast('Error creating property: ' + propErr.message); setCreating(false); return }

    // Step 3: create profile with property_id
    await supabase.from('profiles').insert({
      id: userId,
      full_name: form.full_name,
      role: 'owner',
      is_admin: false,
      property_id: prop.id
    })

    showToast('✅ Owner + property created successfully!')
    setShowAddOwner(false)
    setForm({
      full_name: '', email: '', password: '',
      prop_name: '', city: '', address: '',
      plan_type: 'trial', subscription_status: 'active',
      trial_end_date: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
      gpay_number: ''
    })
    setCreating(false)
    load()
  }

  const handleAddProperty = async () => {
    if (!propForm.name || !selectedOwner) { showToast('Fill property name'); return }
    const { error } = await supabase.from('properties').insert({
      owner_id: selectedOwner.id,
      ...propForm
    })
    if (error) { showToast('Error: ' + error.message); return }

    // Also insert a new profile row for this owner+property
    await supabase.from('profiles').insert({
      id: selectedOwner.id,
      full_name: selectedOwner.full_name,
      role: 'owner',
      is_admin: false,
      property_id: null // will be updated after property created
    }).select().single()

    showToast('Property added!')
    setShowAddProperty(false)
    setPropForm({ name: '', address: '', city: '', plan_type: 'trial', subscription_status: 'active', trial_end_date: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10), gpay_number: '' })
    load()
  }

  const handleUpdatePlan = async (propertyId, plan_type, subscription_status) => {
    await supabase.from('properties').update({ plan_type, subscription_status }).eq('id', propertyId)
    showToast('Plan updated')
    load()
  }

  const planColor = (plan) => {
    if (plan === 'pro') return 'badge-green'
    return 'badge-amber'
  }

  if (loading) return <div className="loading">Loading admin panel...</div>

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Admin panel</h1>
        <button className="btn btn-primary" onClick={() => setShowAddOwner(true)}>+ Add owner</button>
      </div>

      {/* Metrics */}
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

      {/* Owner list */}
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
                      {prop.gpay_number && ` · GPay: ${prop.gpay_number}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className={`badge ${planColor(prop.plan_type)}`}>{prop.plan_type}</span>
                    <span className={`badge ${prop.subscription_status === 'active' ? 'badge-green' : 'badge-red'}`}>
                      {prop.subscription_status}
                    </span>
                    {prop.plan_type !== 'owned' && (
                      <>
                        <select value={prop.plan_type}
                          onChange={e => handleUpdatePlan(prop.id, e.target.value, prop.subscription_status)}
                          style={{ fontSize: 12, padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 4, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text)' }}>
                          {PLAN_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <select value={prop.subscription_status}
                          onChange={e => handleUpdatePlan(prop.id, prop.plan_type, e.target.value)}
                          style={{ fontSize: 12, padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 4, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text)' }}>
                          <option value="active">active</option>
                          <option value="expired">expired</option>
                          <option value="suspended">suspended</option>
                        </select>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Add Owner Modal — one form for everything */}
      {showAddOwner && (
        <Modal title="Add new owner" onClose={() => setShowAddOwner(false)}
          footer={
            <>
              <button className="btn" onClick={() => setShowAddOwner(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddOwner} disabled={creating}>
                {creating ? 'Creating...' : '✅ Create owner & property'}
              </button>
            </>
          }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Owner section */}
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', paddingBottom: 4, borderBottom: '1px solid var(--border)' }}>
              Owner details
            </div>
            <div className="form-group"><label>Full name *</label><input placeholder="John Mathew" value={form.full_name} onChange={f('full_name')} /></div>
            <div className="form-group"><label>Email *</label><input type="email" placeholder="john@example.com" value={form.email} onChange={f('email')} /></div>
            <div className="form-group"><label>Password *</label><input type="password" placeholder="Min 6 characters" value={form.password} onChange={f('password')} /></div>

            {/* Property section */}
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', paddingBottom: 4, borderBottom: '1px solid var(--border)', marginTop: 4 }}>
              Property details
            </div>
            <div className="form-group"><label>Property name *</label><input placeholder="Sunrise Hostel" value={form.prop_name} onChange={f('prop_name')} /></div>
            <div className="form-grid">
              <div className="form-group"><label>City</label><input placeholder="Kochi" value={form.city} onChange={f('city')} /></div>
              <div className="form-group"><label>GPay number</label><input placeholder="9947XXXXXX" value={form.gpay_number} onChange={f('gpay_number')} /></div>
            </div>
            <div className="form-group"><label>Address</label><input placeholder="Full address" value={form.address} onChange={f('address')} /></div>
            <div className="form-grid">
              <div className="form-group"><label>Plan</label>
                <select value={form.plan_type} onChange={f('plan_type')}>
                  {PLAN_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Trial end date</label>
                <input type="date" value={form.trial_end_date} onChange={f('trial_end_date')} />
              </div>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg)', padding: '8px 12px', borderRadius: 6 }}>
              This creates the login account, property, and links them together automatically.
            </div>
          </div>
        </Modal>
      )}

      {/* Add Property to existing owner */}
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
              <div className="form-group"><label>GPay number</label><input placeholder="9947XXXXXX" value={propForm.gpay_number} onChange={pf('gpay_number')} /></div>
            </div>
            <div className="form-group"><label>Address</label><input placeholder="Full address" value={propForm.address} onChange={pf('address')} /></div>
            <div className="form-grid">
              <div className="form-group"><label>Plan</label>
                <select value={propForm.plan_type} onChange={pf('plan_type')}>
                  {PLAN_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Trial end date</label>
                <input type="date" value={propForm.trial_end_date} onChange={pf('trial_end_date')} />
              </div>
            </div>
          </div>
        </Modal>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
