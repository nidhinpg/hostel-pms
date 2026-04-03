import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'

const fmt = n => '₹' + Number(n).toLocaleString('en-IN')

export default function Tenants() {
  const [tenants, setTenants] = useState([])
  const [vacantBeds, setVacantBeds] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [toast, setToast] = useState('')
  const [form, setForm] = useState({
    name: '', phone: '', aadhar: '', bed_id: '',
    movein_date: new Date().toISOString().slice(0, 10),
    rent: '', advance: ''
  })

  const load = useCallback(async () => {
    const [t, b] = await Promise.all([
      supabase.from('tenants').select('*').neq('status', 'vacated').order('created_at', { ascending: false }),
      supabase.from('beds').select('id').eq('status', 'vacant').order('id'),
    ])
    setTenants(t.data || [])
    setVacantBeds(b.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const handleAdd = async () => {
    if (!form.name || !form.bed_id || !form.rent) { showToast('Fill name, bed and rent'); return }
    const rent = parseInt(form.rent) || 0
    const advance = parseInt(form.advance) || 0

    const { error } = await supabase.from('tenants').insert({
      name: form.name, phone: form.phone, aadhar: form.aadhar,
      bed_id: form.bed_id, movein_date: form.movein_date,
      rent, advance, status: 'active'
    })
    if (error) { showToast('Error adding tenant'); return }

    await supabase.from('beds').update({ status: 'occupied' }).eq('id', form.bed_id)

    if (advance > 0) {
      await supabase.from('transactions').insert({
        date: form.movein_date, type: 'income', category: 'Advance',
        description: form.name + ' - advance payment', amount: advance
      })
    }

    showToast('Tenant added!')
    setShowAdd(false)
    setForm({ name: '', phone: '', aadhar: '', bed_id: '', movein_date: new Date().toISOString().slice(0, 10), rent: '', advance: '' })
    load()
  }

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  if (loading) return <div className="loading">Loading tenants...</div>

  const active = tenants.filter(t => t.status === 'active').length
  const due = tenants.filter(t => t.status === 'due').length

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Tenants</h1>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add tenant</button>
      </div>

      <div className="metrics" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', marginBottom: 20 }}>
        <div className="metric"><div className="metric-label">Total tenants</div><div className="metric-value">{tenants.length}</div></div>
        <div className="metric"><div className="metric-label">Active</div><div className="metric-value" style={{ color: 'var(--green)' }}>{active}</div></div>
        <div className="metric"><div className="metric-label">Due</div><div className="metric-value" style={{ color: 'var(--red)' }}>{due}</div></div>
        <div className="metric"><div className="metric-label">Vacant beds</div><div className="metric-value">{vacantBeds.length}</div></div>
      </div>

      <div className="card">
        {tenants.length === 0 ? (
          <div className="empty">No tenants yet. Add your first tenant!</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Name</th><th>Bed</th><th>Phone</th><th>Move-in</th><th>Rent</th><th>Status</th></tr>
              </thead>
              <tbody>
                {tenants.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 500 }}>{t.name}</td>
                    <td><span className="badge badge-blue">{t.bed_id}</span></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{t.phone}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{t.movein_date}</td>
                    <td style={{ fontWeight: 600 }}>{fmt(t.rent)}</td>
                    <td>
                      <span className={`badge ${t.status === 'active' ? 'badge-green' : 'badge-red'}`}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdd && (
        <Modal title="Add new tenant" onClose={() => setShowAdd(false)}
          footer={
            <>
              <button className="btn" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAdd}>Save tenant</button>
            </>
          }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-grid">
              <div className="form-group"><label>Full name *</label><input placeholder="Rahul Nair" value={form.name} onChange={f('name')} /></div>
              <div className="form-group"><label>Phone</label><input placeholder="9876543210" value={form.phone} onChange={f('phone')} /></div>
            </div>
            <div className="form-grid">
              <div className="form-group"><label>Aadhaar no.</label><input placeholder="XXXX XXXX XXXX" value={form.aadhar} onChange={f('aadhar')} /></div>
              <div className="form-group">
                <label>Bed *</label>
                <select value={form.bed_id} onChange={f('bed_id')}>
                  <option value="">Select bed</option>
                  {vacantBeds.map(b => <option key={b.id} value={b.id}>{b.id}</option>)}
                </select>
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group"><label>Move-in date</label><input type="date" value={form.movein_date} onChange={f('movein_date')} /></div>
              <div className="form-group"><label>Monthly rent (₹) *</label><input type="number" placeholder="5000" value={form.rent} onChange={f('rent')} /></div>
            </div>
            <div className="form-grid single">
              <div className="form-group"><label>Advance paid (₹)</label><input type="number" placeholder="0" value={form.advance} onChange={f('advance')} /></div>
            </div>
          </div>
        </Modal>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
