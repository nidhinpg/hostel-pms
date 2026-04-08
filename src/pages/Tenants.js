import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'

const fmt = n => '₹' + Number(n).toLocaleString('en-IN')

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function currentDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export default function Tenants() {
  const [tenants, setTenants] = useState([])
  const [vacantBeds, setVacantBeds] = useState([])
  const [rentPayments, setRentPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showCollect, setShowCollect] = useState(false)
  const [selectedTenant, setSelectedTenant] = useState(null)
  const [collectAmount, setCollectAmount] = useState('')
  const [collectDate, setCollectDate] = useState(currentDate())
  const [toast, setToast] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [form, setForm] = useState({
    name: '', phone: '', aadhar: '', bed_id: '',
    movein_date: currentDate(), rent: '', advance: ''
  })

  const month = currentMonth()

  const load = useCallback(async () => {
    const [t, b, rp] = await Promise.all([
      supabase.from('tenants').select('*').neq('status', 'vacated').order('name'),
      supabase.from('beds').select('id').eq('status', 'vacant').order('id'),
      supabase.from('rent_payments').select('tenant_id, amount, paid_date').eq('month', month),
    ])
    setTenants(t.data || [])
    setVacantBeds(b.data || [])
    setRentPayments(rp.data || [])
    setLoading(false)
  }, [month])

  useEffect(() => { load() }, [load])

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000) }
  const isPaid = (tenantId) => rentPayments.some(r => r.tenant_id === tenantId)
  const getPayment = (tenantId) => rentPayments.find(r => r.tenant_id === tenantId)

  const openCollect = (tenant) => {
    setSelectedTenant(tenant)
    setCollectAmount(String(tenant.rent))
    setCollectDate(currentDate())
    setShowCollect(true)
  }

  const handleCollectRent = async () => {
    if (!collectAmount) { showToast('Enter amount'); return }
    const amount = parseInt(collectAmount)

    const { error: rpErr } = await supabase.from('rent_payments').upsert({
      tenant_id: selectedTenant.id,
      month,
      amount,
      paid_date: collectDate
    }, { onConflict: 'tenant_id,month' })

    if (rpErr) { showToast('Error: ' + rpErr.message); return }

    await supabase.from('transactions').insert({
      date: collectDate,
      type: 'income',
      category: 'Rent',
      description: `${selectedTenant.name} — ${month} rent`,
      amount
    })

    if (selectedTenant.status === 'due') {
      await supabase.from('tenants').update({ status: 'active' }).eq('id', selectedTenant.id)
    }

    showToast(`Rent collected from ${selectedTenant.name}`)
    setShowCollect(false)
    load()
  }

  const handleUndoPayment = async (tenant) => {
    if (!window.confirm(`Undo ${tenant.name}'s payment for ${month}?`)) return
    await supabase.from('rent_payments').delete().eq('tenant_id', tenant.id).eq('month', month)
    showToast('Payment undone')
    load()
  }

  const handleAdd = async () => {
    if (!form.name || !form.bed_id || !form.rent) { showToast('Fill name, bed and rent'); return }
    const rent = parseInt(form.rent) || 0
    const advance = parseInt(form.advance) || 0

    const { error } = await supabase.from('tenants').insert({
      name: form.name, phone: form.phone, aadhar: form.aadhar,
      bed_id: form.bed_id, movein_date: form.movein_date,
      rent, advance, status: 'active'
    })
    if (error) { showToast('Error: ' + error.message); return }

    await supabase.from('beds').update({ status: 'occupied' }).eq('id', form.bed_id)

    if (advance > 0) {
      await supabase.from('transactions').insert({
        date: form.movein_date, type: 'income', category: 'Advance',
        description: form.name + ' — advance payment', amount: advance
      })
    }

    showToast('Tenant added!')
    setShowAdd(false)
    setForm({ name: '', phone: '', aadhar: '', bed_id: '', movein_date: currentDate(), rent: '', advance: '' })
    load()
  }

  const getWhatsAppMsg = (tenant) => {
    const msg = `Hi ${tenant.name.split(' ')[0]}, your rent of ${fmt(tenant.rent)} for ${month} is due. Please pay at the earliest. — ABDF Hostel`
    return `https://wa.me/91${tenant.phone}?text=${encodeURIComponent(msg)}`
  }

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  if (loading) return <div className="loading">Loading tenants...</div>

  const paidThisMonth = tenants.filter(t => isPaid(t.id)).length
  const unpaidCount = tenants.length - paidThisMonth
  const totalRentDue = tenants.filter(t => !isPaid(t.id)).reduce((a, t) => a + t.rent, 0)

  const filteredTenants = tenants.filter(t => {
    if (filterStatus === 'paid') return isPaid(t.id)
    if (filterStatus === 'due') return !isPaid(t.id)
    return true
  })

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Tenants</h1>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add tenant</button>
      </div>

      {/* Metrics */}
      <div className="metrics" style={{ marginBottom: 20 }}>
        <div className="metric">
          <div className="metric-label">Total tenants</div>
          <div className="metric-value">{tenants.length}</div>
          <div className="metric-sub">{vacantBeds.length} beds vacant</div>
        </div>
        <div className="metric">
          <div className="metric-label">Paid this month</div>
          <div className="metric-value" style={{ color: 'var(--green)' }}>{paidThisMonth}</div>
          <div className="metric-sub">{month}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Not paid</div>
          <div className="metric-value" style={{ color: unpaidCount > 0 ? 'var(--red)' : 'var(--green)' }}>{unpaidCount}</div>
          <div className="metric-sub">tenants</div>
        </div>
        <div className="metric">
          <div className="metric-label">Rent outstanding</div>
          <div className="metric-value" style={{ color: totalRentDue > 0 ? 'var(--red)' : 'var(--green)', fontSize: 18 }}>
            {fmt(totalRentDue)}
          </div>
          <div className="metric-sub">to collect</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[['all', 'All'], ['due', 'Not paid'], ['paid', 'Paid']].map(([val, label]) => (
          <button key={val} onClick={() => setFilterStatus(val)}
            className={`btn ${filterStatus === val ? 'btn-primary' : ''}`}
            style={{ fontSize: 12, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 5 }}>
            {label}
            {val === 'due' && unpaidCount > 0 && (
              <span style={{ background: 'var(--red)', color: 'white', borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>
                {unpaidCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tenant list */}
      <div className="card">
        {filteredTenants.length === 0 ? (
          <div className="empty">No tenants found</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Bed</th>
                  <th>Rent</th>
                  <th>{month}</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTenants.map(t => {
                  const paid = isPaid(t.id)
                  const payment = getPayment(t.id)
                  return (
                    <tr key={t.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{t.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{t.phone}</div>
                      </td>
                      <td><span className="badge badge-blue">{t.bed_id}</span></td>
                      <td style={{ fontWeight: 600 }}>{fmt(t.rent)}</td>
                      <td>
                        {paid ? (
                          <div>
                            <span className="badge badge-green">Paid</span>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                              {payment?.paid_date} · {fmt(payment?.amount)}
                            </div>
                          </div>
                        ) : (
                          <span className="badge badge-red">Due</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {!paid ? (
                            <>
                              <button className="btn btn-primary" style={{ fontSize: 11, padding: '4px 10px' }}
                                onClick={() => openCollect(t)}>
                                Collect rent
                              </button>
                              {t.phone && (
                                <a href={getWhatsAppMsg(t)} target="_blank" rel="noreferrer"
                                  className="btn" style={{ fontSize: 11, padding: '4px 10px', textDecoration: 'none', color: 'var(--green)', borderColor: '#a8d5bb', background: 'var(--green-bg)' }}>
                                  WhatsApp
                                </a>
                              )}
                            </>
                          ) : (
                            <button className="btn" style={{ fontSize: 11, padding: '4px 10px', color: 'var(--text-tertiary)' }}
                              onClick={() => handleUndoPayment(t)}>
                              Undo
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Collect rent modal */}
      {showCollect && selectedTenant && (
        <Modal title={`Collect rent — ${selectedTenant.name}`} onClose={() => setShowCollect(false)}
          footer={
            <>
              <button className="btn" onClick={() => setShowCollect(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCollectRent}>Confirm payment</button>
            </>
          }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
              <div className="row-between" style={{ marginBottom: 4 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Tenant</span>
                <span style={{ fontWeight: 500 }}>{selectedTenant.name}</span>
              </div>
              <div className="row-between" style={{ marginBottom: 4 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Bed</span>
                <span>{selectedTenant.bed_id}</span>
              </div>
              <div className="row-between">
                <span style={{ color: 'var(--text-secondary)' }}>Month</span>
                <span style={{ fontWeight: 500 }}>{month}</span>
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label>Amount (₹)</label>
                <input type="number" value={collectAmount} onChange={e => setCollectAmount(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Payment date</label>
                <input type="date" value={collectDate} onChange={e => setCollectDate(e.target.value)} />
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--green)', background: 'var(--green-bg)', padding: '8px 12px', borderRadius: 6 }}>
              Auto-adds to Income & expenses as rent income.
            </div>
          </div>
        </Modal>
      )}

      {/* Add tenant modal */}
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
