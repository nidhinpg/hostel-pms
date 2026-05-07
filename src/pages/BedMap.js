import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'

const STRUCTURE = [
  { floor: 'Floor 1', rooms: ['101', '102', '103', '104'] },
  { floor: 'Floor 2', rooms: ['201', '202', '203', '204', '205'] },
  { floor: 'Floor 3', rooms: ['301', '302', '303', '304'] }
]

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function BedMap({ propertyId, isStaff = false, canAddBeds = true }) {
  const [beds, setBeds] = useState([])
  const [tenants, setTenants] = useState([])
  const [rentPayments, setRentPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showCollect, setShowCollect] = useState(false)
  const [collectTenant, setCollectTenant] = useState(null)
  const [collectForm, setCollectForm] = useState({ amount: '', date: new Date().toISOString().slice(0, 10), note: '' })
  const [newBed, setNewBed] = useState({ id: '', status: 'vacant' })
  const [toast, setToast] = useState('')

  const load = useCallback(async () => {
    const [b, t, rp] = await Promise.all([
      supabase.from('beds').select('*').eq('property_id', propertyId).order('id'),
      supabase.from('tenants').select('*').eq('property_id', propertyId).eq('status', 'active'),
      supabase.from('rent_payments').select('tenant_id').eq('property_id', propertyId).eq('month', currentMonth()),
    ])
    setBeds(b.data || [])
    setTenants(t.data || [])
    setRentPayments(rp.data || [])
    setLoading(false)
  }, [propertyId])

  useEffect(() => { load() }, [load])

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 2500) }
  const getTenant = bedId => tenants.find(t => t.bed_id === bedId)

  const isPaid = (tenantId) => rentPayments.some(r => r.tenant_id === tenantId)
  const isDue = (tenant) => {
    if (!tenant || isPaid(tenant.id)) return false
    const todayDay = new Date().getDate()
    const joinDay = tenant.movein_date ? parseInt(tenant.movein_date.split('-')[2]) : 1
    return todayDay >= joinDay - 1
  }

  const bedsByRoom = beds.reduce((acc, bed) => {
    const room = bed.id.replace(/[A-Z]+$/, '')
    if (!acc[room]) acc[room] = []
    acc[room].push(bed)
    return acc
  }, {})

  const handleSetStatus = async (status) => {
    await supabase.from('beds').update({ status }).eq('id', selected.id).eq('property_id', propertyId)
    if (status === 'vacant') {
      const t = getTenant(selected.id)
      if (t) await supabase.from('tenants').update({ status: 'vacated' }).eq('id', t.id)
    }
    showToast(`Bed marked as ${status}`)
    setSelected(null)
    load()
  }

  const handleDeleteBed = async () => {
    const t = getTenant(selected.id)
    if (t) { showToast('Cannot delete — bed has active tenant'); return }
    if (!window.confirm(`Delete bed ${selected.id}?`)) return
    const { error } = await supabase.from('beds').delete().eq('id', selected.id).eq('property_id', propertyId)
    if (error) {
      showToast(error.code === '23503' ? 'Clear tenant history first' : 'Error: could not delete bed')
      return
    }
    showToast('Bed deleted')
    setSelected(null)
    load()
  }

  const handleAddBed = async () => {
    if (!newBed.id.trim()) return
    const { error } = await supabase.from('beds').insert({
      id: newBed.id.trim().toUpperCase(),
      status: newBed.status,
      property_id: propertyId
    })
    if (error) { showToast('Bed ID already exists'); return }
    showToast('Bed added')
    setShowAdd(false)
    setNewBed({ id: '', status: 'vacant' })
    load()
  }

  const openCollect = (tenant) => {
    setCollectTenant(tenant)
    setCollectForm({ amount: tenant.rent || '', date: new Date().toISOString().slice(0, 10), note: '' })
    setSelected(null)
    setShowCollect(true)
  }

  const handleCollectRent = async () => {
    if (!collectForm.amount) { showToast('Enter amount'); return }
    const month = currentMonth()
    const { error } = await supabase.from('rent_payments').upsert({
      tenant_id: collectTenant.id,
      property_id: propertyId,
      month,
      amount: parseInt(collectForm.amount),
      paid_date: collectForm.date,
    })
    if (error) { showToast('Error: ' + error.message); return }
    await supabase.from('transactions').insert({
      property_id: propertyId,
      type: 'income',
      category: 'Rent',
      amount: parseInt(collectForm.amount),
      date: collectForm.date,
      description: `Rent - ${collectTenant.name} (${collectTenant.bed_id})${collectForm.note ? ' - ' + collectForm.note : ''}`
    })
    showToast(`Rent collected from ${collectTenant.name} ✓`)
    setShowCollect(false)
    setCollectTenant(null)
    load()
  }

 const openWhatsApp = (tenant) => {
  const phone = tenant.phone?.replace(/\D/g, '')
  const url = `https://wa.me/91${phone}`
  window.open(url, '_blank')
  setSelected(null)
}

  if (loading) return <div className="loading">Loading beds...</div>

  const occupied = beds.filter(b => b.status === 'occupied').length
  const vacant = beds.filter(b => b.status === 'vacant').length
  const dueCount = tenants.filter(t => isDue(t)).length

  const BedCard = ({ bed, style = {} }) => {
    const t = getTenant(bed.id)
    const due = isDue(t)
    return (
      <div
        key={bed.id}
        className={`bed-card ${bed.status}`}
        onClick={() => setSelected(bed)}
        style={{ minWidth: 72, flex: '0 0 auto', position: 'relative', ...style }}
      >
        <span className="bed-num">{bed.id}</span>
        <span className="bed-name">
          {bed.status === 'occupied' && t ? t.name.split(' ')[0] : bed.status === 'maintenance' ? 'Maint.' : 'Free'}
        </span>
        {due && (
          <span style={{
            position: 'absolute', top: -6, right: -6,
            background: 'var(--red)', color: 'white',
            borderRadius: '50%', width: 18, height: 18,
            fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
          }}>!</span>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Bed map</h1>
        {(!isStaff || canAddBeds) && !isStaff && (
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add bed</button>
        )}
      </div>

      <div className="legend">
        <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--green)' }} />{occupied} Occupied</div>
        <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--border-strong)' }} />{vacant} Vacant</div>
        {dueCount > 0 && (
          <div className="legend-item">
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--red)', display: 'inline-block', marginRight: 4 }} />
            {dueCount} Rent due
          </div>
        )}
      </div>

      {STRUCTURE.map(({ floor, rooms }) => {
        const floorBeds = rooms.flatMap(r => bedsByRoom[r] || [])
        const floorOcc = floorBeds.filter(b => b.status === 'occupied').length
        if (floorBeds.length === 0) return null
        return (
          <div key={floor} style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--text)', color: 'white', padding: '10px 16px', borderRadius: 'var(--radius)', marginBottom: 12 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{floor}</span>
              <span style={{ fontSize: 12, opacity: 0.8 }}>{floorOcc}/{floorBeds.length} occupied</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {rooms.map(roomNum => {
                const roomBeds = bedsByRoom[roomNum] || []
                if (roomBeds.length === 0) return null
                const roomOcc = roomBeds.filter(b => b.status === 'occupied').length
                return (
                  <div key={roomNum} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>Room {roomNum}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{roomBeds.length} bed{roomBeds.length > 1 ? 's' : ''}</span>
                        <span className={`badge ${roomOcc === roomBeds.length ? 'badge-red' : roomOcc === 0 ? 'badge-blue' : 'badge-amber'}`} style={{ fontSize: 10 }}>
                          {roomOcc === roomBeds.length ? 'Full' : roomOcc === 0 ? 'Empty' : `${roomBeds.length - roomOcc} free`}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 12 }}>
                      {roomBeds.map(bed => <BedCard key={bed.id} bed={bed} />)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Ungrouped beds */}
      {(() => {
        const known = STRUCTURE.flatMap(f => f.rooms)
        const ungrouped = beds.filter(b => !known.includes(b.id.replace(/[A-Z]+$/, '')))
        if (!ungrouped.length) return null
        return (
          <div style={{ marginBottom: 28 }}>
            <div style={{ background: 'var(--text-secondary)', color: 'white', padding: '10px 16px', borderRadius: 'var(--radius)', marginBottom: 12, fontSize: 14, fontWeight: 600 }}>Other beds</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ungrouped.map(bed => <BedCard key={bed.id} bed={bed} />)}
            </div>
          </div>
        )
      })()}

      {/* Bed detail modal */}
      {selected && (() => {
        const t = getTenant(selected.id)
        const due = isDue(t)
        const paid = t ? isPaid(t.id) : false
        return (
          <Modal title={`Bed ${selected.id}`} onClose={() => setSelected(null)}
            footer={
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {!isStaff && <button className="btn btn-danger" onClick={handleDeleteBed}>Delete bed</button>}
                {!isStaff && selected.status !== 'vacant' && <button className="btn" onClick={() => handleSetStatus('vacant')}>Mark vacant</button>}
                <button className="btn" onClick={() => setSelected(null)}>Close</button>
              </div>
            }>
            <div style={{ fontSize: 13 }}>
              <div className="row-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Status</span>
                <span className={`badge ${selected.status === 'occupied' ? 'badge-green' : selected.status === 'maintenance' ? 'badge-amber' : 'badge-blue'}`}>{selected.status}</span>
              </div>
              {t ? (
                <>
                  <div className="row-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Tenant</span>
                    <span style={{ fontWeight: 500 }}>{t.name}</span>
                  </div>
                  <div className="row-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Phone</span>
                    <span>{t.phone}</span>
                  </div>
                  <div className="row-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Move-in</span>
                    <span>{t.movein_date}</span>
                  </div>
                  <div className="row-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Rent</span>
                    <span style={{ fontWeight: 600 }}>₹{Number(t.rent).toLocaleString('en-IN')}/mo</span>
                  </div>
                  <div className="row-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Rent status</span>
                    {paid
                      ? <span className="badge badge-green">Paid ✓</span>
                      : due
                      ? <span className="badge badge-red">Due !</span>
                      : <span className="badge badge-amber">Upcoming</span>
                    }
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                    {!paid ? (
                      <button
                        className="btn btn-primary"
                        style={{ flex: 1, fontSize: 13, padding: '9px 12px' }}
                        onClick={() => openCollect(t)}>
                        💰 Collect rent
                      </button>
                    ) : (
                      <div style={{ flex: 1, textAlign: 'center', padding: '9px 12px', background: 'var(--green-bg)', color: 'var(--green)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 500 }}>
                        ✓ Rent paid this month
                      </div>
                    )}
                    {t.phone && (
                      <button
                        onClick={() => openWhatsApp(t)}
                        style={{ background: '#25D366', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', padding: '9px 14px', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', fontWeight: 500 }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="white">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                        WhatsApp
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="empty" style={{ padding: '20px 0' }}>No tenant assigned</div>
              )}
            </div>
          </Modal>
        )
      })()}

      {/* Collect Rent Modal */}
      {showCollect && collectTenant && (
        <Modal title={`Collect rent — ${collectTenant.name}`} onClose={() => setShowCollect(false)}
          footer={
            <>
              <button className="btn" onClick={() => setShowCollect(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCollectRent}>Confirm payment</button>
            </>
          }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Tenant</span>
                <span style={{ fontWeight: 500 }}>{collectTenant.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Bed</span>
                <span>{collectTenant.bed_id}</span>
              </div>
            </div>
            <div className="form-group">
              <label>Amount (₹)</label>
              <input
                type="number"
                value={collectForm.amount}
                onChange={e => setCollectForm(p => ({ ...p, amount: e.target.value }))}
                placeholder="Enter amount"
              />
            </div>
            <div className="form-group">
              <label>Payment date</label>
              <input
                type="date"
                value={collectForm.date}
                onChange={e => setCollectForm(p => ({ ...p, date: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Note (optional)</label>
              <input
                placeholder="e.g. Cash / UPI / Partial"
                value={collectForm.note}
                onChange={e => setCollectForm(p => ({ ...p, note: e.target.value }))}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Add bed modal */}
      {showAdd && (
        <Modal title="Add new bed" onClose={() => setShowAdd(false)}
          footer={<><button className="btn" onClick={() => setShowAdd(false)}>Cancel</button><button className="btn btn-primary" onClick={handleAddBed}>Add bed</button></>}>
          <div className="form-grid">
            <div className="form-group"><label>Bed ID</label><input placeholder="e.g. 101E" value={newBed.id} onChange={e => setNewBed(p => ({ ...p, id: e.target.value }))} /></div>
            <div className="form-group"><label>Status</label>
              <select value={newBed.status} onChange={e => setNewBed(p => ({ ...p, status: e.target.value }))}>
                <option value="vacant">Vacant</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
          </div>
        </Modal>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
