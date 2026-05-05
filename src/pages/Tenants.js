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

export default function Tenants({ propertyId, isStaff = false, initialFilter = 'all' }) {
  const [tenants, setTenants] = useState([])
  const [vacatedTenants, setVacatedTenants] = useState([])
  const [vacantBeds, setVacantBeds] = useState([])
  const [rentPayments, setRentPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showCollect, setShowCollect] = useState(false)
  const [showVacate, setShowVacate] = useState(false)
  const [selectedTenant, setSelectedTenant] = useState(null)
  const [collectAmount, setCollectAmount] = useState('')
  const [collectDate, setCollectDate] = useState(currentDate())
  const [vacateDate, setVacateDate] = useState(currentDate())
  const [daysPaid, setDaysPaid] = useState('')
  const [isPartialPay, setIsPartialPay] = useState(false)
  const [receiptData, setReceiptData] = useState(null)
  const [toast, setToast] = useState('')
  const [tab, setTab] = useState('active')
  const [filterStatus, setFilterStatus] = useState(initialFilter)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({
    name: '', phone: '', aadhar: '', bed_id: '',
    movein_date: currentDate(), rent: '', advance: ''
  })

  const month = currentMonth()

  useEffect(() => { setFilterStatus(initialFilter) }, [initialFilter])

  const load = useCallback(async () => {
    const [t, vacated, b, rp] = await Promise.all([
      supabase.from('tenants').select('*').eq('property_id', propertyId).neq('status', 'vacated').order('name'),
      supabase.from('tenants').select('*').eq('property_id', propertyId).eq('status', 'vacated').order('updated_at', { ascending: false }),
      supabase.from('beds').select('id').eq('property_id', propertyId).eq('status', 'vacant').order('id'),
      supabase.from('rent_payments').select('tenant_id, amount, paid_date, stay_end_date, days_paid').eq('property_id', propertyId).eq('month', month),
    ])
    setTenants(t.data || [])
    setVacatedTenants(vacated.data || [])
    setVacantBeds(b.data || [])
    setRentPayments(rp.data || [])
    setLoading(false)
  }, [propertyId, month])

  useEffect(() => { load() }, [load])

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000) }
  const isPaid = id => rentPayments.some(r => r.tenant_id === id)
  const getPayment = id => rentPayments.find(r => r.tenant_id === id)

  const getRentStatus = (tenant) => {
    if (isPaid(tenant.id)) return 'paid'
    const today = new Date()
    const todayDay = today.getDate()
    const joinDay = tenant.movein_date ? parseInt(tenant.movein_date.split('-')[2]) : 1
    if (todayDay >= joinDay - 1) return 'due'
    return 'upcoming'
  }
  const isDue = (tenant) => getRentStatus(tenant) === 'due'

  const getDaysRemaining = (tenantId) => {
    const payment = getPayment(tenantId)
    if (!payment || !payment.stay_end_date) return null
    const today = new Date()
    const end = new Date(payment.stay_end_date)
    const diff = Math.ceil((end - today) / (1000 * 60 * 60 * 24))
    return diff
  }

  const openCollect = (tenant) => {
    setSelectedTenant(tenant)
    setCollectAmount(String(tenant.rent))
    setCollectDate(currentDate())
    setDaysPaid('')
    setIsPartialPay(false)
    setShowCollect(true)
  }

  const openVacate = (tenant) => {
    setSelectedTenant(tenant)
    setVacateDate(currentDate())
    setShowVacate(true)
  }

  const handleCollectRent = async () => {
    if (!collectAmount) { showToast('Enter amount'); return }
    const amount = parseInt(collectAmount)

    let stayEndDate = null
    if (isPartialPay && daysPaid) {
      const baseDate = selectedTenant.movein_date ? new Date(selectedTenant.movein_date) : new Date(collectDate)
      baseDate.setDate(baseDate.getDate() + parseInt(daysPaid) - 1)
      stayEndDate = `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}-${String(baseDate.getDate()).padStart(2, '0')}`
    }

    const { error } = await supabase.from('rent_payments').upsert({
      tenant_id: selectedTenant.id, month, amount,
      paid_date: collectDate, property_id: propertyId,
      days_paid: isPartialPay && daysPaid ? parseInt(daysPaid) : null,
      stay_end_date: stayEndDate
    }, { onConflict: 'tenant_id,month' })
    if (error) { showToast('Error: ' + error.message); return }

    const desc = isPartialPay && daysPaid
      ? `${selectedTenant.name} — ${daysPaid} days rent (till ${stayEndDate})`
      : `${selectedTenant.name} — ${month} rent`

    await supabase.from('transactions').insert({
      date: collectDate, type: 'income', category: 'Rent',
      description: desc, amount, property_id: propertyId
    })

    if (selectedTenant.status === 'due') {
      await supabase.from('tenants').update({ status: 'active' }).eq('id', selectedTenant.id)
    }

    // Show receipt popup instead of auto-opening WhatsApp
    if (selectedTenant.phone) {
      setReceiptData({
        phone: selectedTenant.phone,
        name: selectedTenant.name,
        bed: selectedTenant.bed_id,
        amount,
        date: collectDate,
        month,
        isPartial: isPartialPay && !!daysPaid,
        days: daysPaid,
        from: selectedTenant.movein_date,
        till: stayEndDate
      })
    }

    showToast(`Rent collected from ${selectedTenant.name}`)
    setShowCollect(false)
    load()
  }

  const handleVacate = async () => {
    await supabase.from('tenants').update({
      status: 'vacated',
      vacate_date: vacateDate
    }).eq('id', selectedTenant.id)
    await supabase.from('beds').update({ status: 'vacant' }).eq('id', selectedTenant.bed_id).eq('property_id', propertyId)
    showToast(`${selectedTenant.name} vacated successfully`)
    setShowVacate(false)
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
      rent, advance, status: 'active', property_id: propertyId
    })
    if (error) { showToast('Error: ' + error.message); return }
    await supabase.from('beds').update({ status: 'occupied' }).eq('id', form.bed_id).eq('property_id', propertyId)
    if (advance > 0) {
      await supabase.from('transactions').insert({
        date: form.movein_date, type: 'income', category: 'Advance',
        description: form.name + ' — advance payment', amount: advance, property_id: propertyId
      })
    }
    showToast('Tenant added!')
    setShowAdd(false)
    setForm({ name: '', phone: '', aadhar: '', bed_id: '', movein_date: currentDate(), rent: '', advance: '' })
    load()
  }

  const getWhatsAppMsg = (tenant) => {
    const msg = `Hi ${tenant.name.split(' ')[0]}, your rent of ${fmt(tenant.rent)} for ${month} is due. Please pay via GPay to 9061780979 (Hosteloops). Thank you! — Hosteloops`
    return `https://wa.me/91${tenant.phone}?text=${encodeURIComponent(msg)}`
  }

  const buildReceiptUrl = (r) => {
    let msg = ''
    if (r.isPartial) {msg = `Hi ${r.name.split(' ')[0]},\nReceipt - Hosteloops Hostel\nBed: ${r.bed}\nAmount paid: ₹${Number(r.amount).toLocaleString('en-IN')}\nDays: ${r.days} days\nValid from: ${r.from}\nValid till: ${r.till}\nThank you! — Hosteloops`
    } else {
msg = `Hi ${r.name.split(' ')[0]},\nReceipt - Hosteloops Hostel\nBed: ${r.bed}\nAmount paid: ₹${Number(r.amount).toLocaleString('en-IN')}\nMonth: ${r.month}\nDate: ${r.date}\nThank you! — Hosteloops`
    }
    return `https://wa.me/91${r.phone}?text=${encodeURIComponent(msg)}`
  }

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  if (loading) return <div className="loading">Loading tenants...</div>

  const paidThisMonth = tenants.filter(t => isPaid(t.id)).length
  const unpaidCount = tenants.filter(t => getRentStatus(t) === 'due').length
  const upcomingCount = tenants.filter(t => getRentStatus(t) === 'upcoming').length
  const totalRentDue = tenants.filter(t => getRentStatus(t) === 'due').reduce((a, t) => a + t.rent, 0)

  const filteredTenants = tenants.filter(t => {
    const matchesStatus = filterStatus === 'paid' ? getRentStatus(t) === 'paid'
      : filterStatus === 'due' ? getRentStatus(t) === 'due'
      : filterStatus === 'upcoming' ? getRentStatus(t) === 'upcoming'
      : true
    const q = search.toLowerCase()
    const matchesSearch = !q || t.name.toLowerCase().includes(q) || (t.bed_id || '').toLowerCase().includes(q) || (t.phone || '').includes(q)
    return matchesStatus && matchesSearch
  })

  const filteredVacated = vacatedTenants.filter(t => {
    const q = search.toLowerCase()
    return !q || t.name.toLowerCase().includes(q) || (t.bed_id || '').toLowerCase().includes(q) || (t.phone || '').includes(q)
  })

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Tenants</h1>
        {!isStaff && tab === 'active' && (
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add tenant</button>
        )}
      </div>

      {/* Main tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {[['active', `Active (${tenants.length})`], ['vacated', `Vacated history (${vacatedTenants.length})`]].map(([val, label]) => (
          <button key={val} onClick={() => setTab(val)}
            style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 500,
              background: 'none', border: 'none', cursor: 'pointer',
              color: tab === val ? 'var(--text)' : 'var(--text-secondary)',
              borderBottom: tab === val ? '2px solid var(--text)' : '2px solid transparent',
              marginBottom: -1
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', fontSize: 15, pointerEvents: 'none' }}>🔍</span>
        <input
          placeholder="Search by name, bed or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '9px 12px 9px 34px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text)' }}
        />
        {search && (
          <button onClick={() => setSearch('')}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 16 }}>×</button>
        )}
      </div>

      {/* ACTIVE TENANTS TAB */}
      {tab === 'active' && (
        <>
          <div className="metrics" style={{ marginBottom: 20 }}>
            <div className="metric"><div className="metric-label">Total tenants</div><div className="metric-value">{tenants.length}</div><div className="metric-sub">{vacantBeds.length} beds vacant</div></div>
            <div className="metric"><div className="metric-label">Paid this month</div><div className="metric-value" style={{ color: 'var(--green)' }}>{paidThisMonth}</div><div className="metric-sub">{month}</div></div>
            <div className="metric"><div className="metric-label">Rent due</div><div className="metric-value" style={{ color: unpaidCount > 0 ? 'var(--red)' : 'var(--green)' }}>{unpaidCount}</div><div className="metric-sub">{upcomingCount} upcoming</div></div>
            <div className="metric"><div className="metric-label">Outstanding</div><div className="metric-value" style={{ color: totalRentDue > 0 ? 'var(--red)' : 'var(--green)', fontSize: 18 }}>{fmt(totalRentDue)}</div><div className="metric-sub">to collect</div></div>
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {[['all', 'All'], ['due', 'Due'], ['upcoming', 'Upcoming'], ['paid', 'Paid']].map(([val, label]) => (
              <button key={val} onClick={() => setFilterStatus(val)}
                className={`btn ${filterStatus === val ? 'btn-primary' : ''}`}
                style={{ fontSize: 12, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 5 }}>
                {label}
                {val === 'due' && unpaidCount > 0 && (
                  <span style={{ background: 'var(--red)', color: 'white', borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>{unpaidCount}</span>
                )}
                {val === 'upcoming' && upcomingCount > 0 && (
                  <span style={{ background: 'var(--amber)', color: 'white', borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>{upcomingCount}</span>
                )}
              </button>
            ))}
          </div>

          <div className="card">
            {filteredTenants.length === 0 ? <div className="empty">No tenants found</div> : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Name</th><th>Bed</th><th>Rent</th><th>{month}</th><th>Actions</th></tr></thead>
                  <tbody>
                    {filteredTenants.map(t => {
                      const status = getRentStatus(t)
                      const payment = getPayment(t.id)
                      const daysLeft = getDaysRemaining(t.id)
                      const joinDay = t.movein_date ? parseInt(t.movein_date.split('-')[2]) : 1
                      return (
                        <tr key={t.id}>
                          <td>
  <div style={{ fontWeight: 500 }}>{t.name}</div>
  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{t.phone}</div>
  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Check-in: {t.movein_date}</div>
</td>                          <td><span className="badge badge-blue">{t.bed_id}</span></td>
                          <td style={{ fontWeight: 600 }}>{fmt(t.rent)}</td>
                          <td>
                            {status === 'paid' ? (
                              <div>
                                <span className="badge badge-green">Paid</span>
                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                                  {payment?.paid_date} · {fmt(payment?.amount)}
                                </div>
                                {payment?.stay_end_date && (
                                  <div style={{ marginTop: 4 }}>
                                    {daysLeft < 0 ? (
                                      <span className="badge badge-red" style={{ fontSize: 10 }}>Stay ended {Math.abs(daysLeft)}d ago</span>
                                    ) : daysLeft <= 3 ? (
                                      <span className="badge badge-red" style={{ fontSize: 10 }}>⚠ {daysLeft === 0 ? 'Ends today!' : `${daysLeft}d left`}</span>
                                    ) : (
                                      <span className="badge badge-amber" style={{ fontSize: 10 }}>{daysLeft}d left · till {payment.stay_end_date}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : status === 'upcoming' ? (
                              <span className="badge badge-amber">Due on {joinDay}th</span>
                            ) : (
                              <span className="badge badge-red">Due</span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {status === 'paid' ? (
                                <button className="btn" style={{ fontSize: 11, padding: '4px 10px', color: 'var(--text-tertiary)' }}
                                  onClick={() => handleUndoPayment(t)}>Undo</button>
                              ) : status === 'due' ? (
                                <>
                                  <button className="btn btn-primary" style={{ fontSize: 11, padding: '4px 10px' }}
                                    onClick={() => openCollect(t)}>Collect rent</button>
                                  {t.phone && (
                                    <a href={getWhatsAppMsg(t)} target="_blank" rel="noreferrer"
                                      className="btn" style={{ fontSize: 11, padding: '4px 10px', textDecoration: 'none', color: 'var(--green)', borderColor: '#a8d5bb', background: 'var(--green-bg)' }}>
                                      WhatsApp
                                    </a>
                                  )}
                                </>
                              ) : (
                                <button className="btn" style={{ fontSize: 11, padding: '4px 10px', color: 'var(--text-tertiary)' }}
                                  onClick={() => openCollect(t)}>Collect early</button>
                              )}
                              {!isStaff && (
                                <button className="btn btn-danger" style={{ fontSize: 11, padding: '4px 10px' }}
                                  onClick={() => openVacate(t)}>Vacate</button>
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
        </>
      )}

      {/* VACATED HISTORY TAB */}
      {tab === 'vacated' && (
        <div className="card">
          {filteredVacated.length === 0 ? (
            <div className="empty">No vacated tenants yet</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Name</th><th>Bed</th><th>Phone</th><th>Move-in</th><th>Vacated on</th><th>Rent</th></tr></thead>
                <tbody>
                  {filteredVacated.map(t => (
                    <tr key={t.id}>
                      <td><div style={{ fontWeight: 500 }}>{t.name}</div><div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{t.aadhar}</div></td>
                      <td><span className="badge badge-blue">{t.bed_id}</span></td>
                      <td style={{ color: 'var(--text-secondary)' }}>{t.phone || '—'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{t.movein_date}</td>
                      <td>{t.vacate_date ? <span className="badge badge-red">{t.vacate_date}</span> : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}</td>
                      <td style={{ fontWeight: 600 }}>{fmt(t.rent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* COLLECT RENT MODAL */}
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
              <div className="row-between" style={{ marginBottom: 4 }}><span style={{ color: 'var(--text-secondary)' }}>Tenant</span><span style={{ fontWeight: 500 }}>{selectedTenant.name}</span></div>
              <div className="row-between" style={{ marginBottom: 4 }}><span style={{ color: 'var(--text-secondary)' }}>Bed</span><span>{selectedTenant.bed_id}</span></div>
              <div className="row-between"><span style={{ color: 'var(--text-secondary)' }}>Monthly rent</span><span style={{ fontWeight: 600 }}>₹{Number(selectedTenant.rent).toLocaleString('en-IN')}</span></div>
            </div>
            <div className="form-grid">
              <div className="form-group"><label>Amount (₹)</label><input type="number" value={collectAmount} onChange={e => setCollectAmount(e.target.value)} /></div>
              <div className="form-group"><label>Payment date</label><input type="date" value={collectDate} onChange={e => setCollectDate(e.target.value)} /></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--border)' }}>
              <input type="checkbox" id="partial-toggle" checked={isPartialPay}
                onChange={e => { setIsPartialPay(e.target.checked); if (!e.target.checked) setDaysPaid('') }}
                style={{ width: 16, height: 16, cursor: 'pointer' }} />
              <label htmlFor="partial-toggle" style={{ fontSize: 13, cursor: 'pointer', color: 'var(--text)' }}>
                Paying for specific days only
              </label>
            </div>
            {isPartialPay && (
              <div className="form-grid">
                <div className="form-group">
                  <label>Number of days paid</label>
                  <input type="number" placeholder="e.g. 15" value={daysPaid} onChange={e => setDaysPaid(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Stay ends on</label>
                  <input type="text" readOnly value={(() => {
                    if (!daysPaid) return '—'
                    const base = selectedTenant.movein_date ? new Date(selectedTenant.movein_date) : new Date(collectDate)
                    base.setDate(base.getDate() + parseInt(daysPaid) - 1)
                    return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`
                  })()} style={{ background: 'var(--bg)', color: 'var(--green)', fontWeight: 600 }} />
                </div>
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--green)', background: 'var(--green-bg)', padding: '8px 12px', borderRadius: 6 }}>
              {isPartialPay && daysPaid
                ? `Will alert when ${selectedTenant.name.split(' ')[0]}'s ${daysPaid} days are ending.`
                : 'Auto-adds to Income & expenses.'}
            </div>
          </div>
        </Modal>
      )}

      {/* VACATE MODAL */}
      {showVacate && selectedTenant && (
        <Modal title={`Vacate — ${selectedTenant.name}`} onClose={() => setShowVacate(false)}
          footer={
            <>
              <button className="btn" onClick={() => setShowVacate(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleVacate}>Confirm vacate</button>
            </>
          }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
              <div className="row-between" style={{ marginBottom: 4 }}><span style={{ color: 'var(--text-secondary)' }}>Tenant</span><span style={{ fontWeight: 500 }}>{selectedTenant.name}</span></div>
              <div className="row-between" style={{ marginBottom: 4 }}><span style={{ color: 'var(--text-secondary)' }}>Bed</span><span>{selectedTenant.bed_id}</span></div>
              <div className="row-between"><span style={{ color: 'var(--text-secondary)' }}>Move-in</span><span>{selectedTenant.movein_date}</span></div>
            </div>
            <div className="form-group">
              <label>Vacate date</label>
              <input type="date" value={vacateDate} onChange={e => setVacateDate(e.target.value)} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--red)', background: 'var(--red-bg)', padding: '8px 12px', borderRadius: 6 }}>
              This will free up bed {selectedTenant.bed_id} and move tenant to vacated history.
            </div>
          </div>
        </Modal>
      )}

      {/* ADD TENANT MODAL */}
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
              <div className="form-group"><label>Bed *</label>
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

      {/* WHATSAPP RECEIPT POPUP */}
      {receiptData && receiptData.phone && (
        <div style={{
          position: 'fixed', bottom: 80, right: 24, zIndex: 200,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '14px 16px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)', maxWidth: 280
        }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>✅ Rent collected!</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Send receipt to {receiptData.name.split(' ')[0]}?
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10, lineHeight: 1.6 }}>
            {receiptData.isPartial
              ? `₹${Number(receiptData.amount).toLocaleString('en-IN')} · ${receiptData.days} days · till ${receiptData.till}`
              : `₹${Number(receiptData.amount).toLocaleString('en-IN')} · ${receiptData.month}`
            }
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" style={{ fontSize: 12, flex: 1 }}
              onClick={() => setReceiptData(null)}>Skip</button>
            <a href={buildReceiptUrl(receiptData)}
              target="_blank" rel="noreferrer"
              className="btn btn-primary"
              style={{ fontSize: 12, flex: 1, textDecoration: 'none', textAlign: 'center' }}
              onClick={() => setReceiptData(null)}>
              WhatsApp ↗
            </a>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
