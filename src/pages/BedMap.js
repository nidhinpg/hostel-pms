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

function currentDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export default function BedMap({ propertyId, isStaff = false, canAddBeds = true }) {
  const [beds, setBeds] = useState([])
  const [tenants, setTenants] = useState([])
  const [rentPayments, setRentPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showVacate, setShowVacate] = useState(false)
  const [vacateDate, setVacateDate] = useState(currentDate())

  const [addMode, setAddMode] = useState('single')
  const [newBed, setNewBed] = useState({ id: '' })
  const [bulkBed, setBulkBed] = useState({ room: '', count: 4, startLetter: 'A' })
  const [toast, setToast] = useState('')

  const load = useCallback(async () => {
    const [b, t, rp] = await Promise.all([
      supabase.from('beds').select('*').eq('property_id', propertyId).order('id'),
      supabase.from('tenants').select('*').eq('property_id', propertyId).eq('status', 'active'),
      supabase.from('rent_payments').select('tenant_id, month').eq('property_id', propertyId),
    ])
    setBeds(b.data || [])
    setTenants(t.data || [])
    setRentPayments(rp.data || [])
    setLoading(false)
  }, [propertyId])

  useEffect(() => { load() }, [load])

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 2500) }
  const getTenant = bedId => tenants.find(t => t.bed_id === bedId)

  const isPaidForMonth = (tenantId, m) => rentPayments.some(r => r.tenant_id === tenantId && r.month === m)
  const isPaid = (tenantId) => isPaidForMonth(tenantId, currentMonth())

  const monthsBetweenInclusive = (start, end) => {
    const [sy, sm] = start.split('-').map(Number)
    const [ey, em] = end.split('-').map(Number)
    const months = []
    let y = sy, m = sm
    while (y < ey || (y === ey && m <= em)) {
      months.push(`${y}-${String(m).padStart(2, '0')}`)
      m++
      if (m > 12) { m = 1; y++ }
    }
    return months
  }

  // Every month from move-in through the current month with no matching
  // rent_payments row — mirrors the arrears logic in Tenants.js so Bed map
  // agrees with the Tenants tab on who's actually due. Checking only "paid
  // this month" made every existing tenant flip to Due the instant a new
  // month started, since day 1 obviously has no payment yet for anyone.
  const getDueMonths = (tenant) => {
    if (!tenant || !tenant.movein_date) return []
    const month = currentMonth()
    const startMonth = tenant.movein_date.slice(0, 7)
    if (startMonth > month) return []
    return monthsBetweenInclusive(startMonth, month).filter(m => !isPaidForMonth(tenant.id, m))
  }

  // Pending days for a daily-billing tenant -- today minus the last date
  // they are paid through, computed live (no background job). Deliberately
  // returns a day count only, never multiplied into a rupee figure -- daily
  // rates vary per hostel/tenant and are not stored as a fixed number here.
  const getDailyPendingDays = (tenant) => {
    if (!tenant || tenant.billing_type !== 'daily') return 0
    const paidThrough = tenant.daily_paid_through_date
      ? new Date(tenant.daily_paid_through_date)
      : (() => { const d = new Date(tenant.movein_date); d.setDate(d.getDate() - 1); return d })()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    paidThrough.setHours(0, 0, 0, 0)
    const diffDays = Math.round((today - paidThrough) / (1000 * 60 * 60 * 24))
    return Math.max(0, diffDays)
  }

  const isDue = (tenant) => {
    if (!tenant) return false
    if (tenant.billing_type === 'daily') return getDailyPendingDays(tenant) > 0
    const dueMonths = getDueMonths(tenant)
    if (dueMonths.length === 0) return false
    const month = currentMonth()
    const pastDue = dueMonths.filter(m => m !== month)
    if (pastDue.length > 0) return true
    const todayDay = new Date().getDate()
    const joinDay = parseInt(tenant.movein_date.split('-')[2])
    return todayDay >= joinDay - 1
  }

  const bedsByRoom = beds.reduce((acc, bed) => {
    const room = bed.id.replace(/[A-Z]+$/, '')
    if (!acc[room]) acc[room] = []
    acc[room].push(bed)
    return acc
  }, {})

  const handleVacate = async () => {
    const t = getTenant(selected.id)
    if (t) {
      await supabase.from('tenants').update({ status: 'vacated', vacate_date: vacateDate }).eq('id', t.id)
    }
    await supabase.from('beds').update({ status: 'vacant' }).eq('id', selected.id).eq('property_id', propertyId)
    showToast(t ? `${t.name} vacated successfully` : 'Bed marked as vacant')
    setShowVacate(false)
    setSelected(null)
    load()
  }

  const handleDeleteBed = async () => {
    const t = getTenant(selected.id)
    if (t) { showToast('Cannot delete — bed has active tenant'); return }
    if (!window.confirm(`Delete bed ${selected.id}?`)) return

    // Step 1: Remove rent payments for any vacated tenants linked to this bed
    const { data: linkedTenants } = await supabase
      .from('tenants')
      .select('id')
      .eq('bed_id', selected.id)
      .eq('property_id', propertyId)

    if (linkedTenants && linkedTenants.length > 0) {
      const ids = linkedTenants.map(t => t.id)
      await supabase.from('rent_payments').delete().in('tenant_id', ids)
      // Step 2: Nullify bed_id on vacated tenants (keeps history)
      await supabase.from('tenants').update({ bed_id: null }).in('id', ids)
    }

    // Step 3: Now delete the bed — use .select() so we know how many rows were actually deleted
    const { data: deleted, error } = await supabase
      .from('beds')
      .delete()
      .eq('id', selected.id)
      .eq('property_id', propertyId)
      .select()

    if (error) {
      showToast('Error: ' + error.message)
      return
    }
    if (!deleted || deleted.length === 0) {
      showToast('Delete blocked by permissions. Check RLS policy.')
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
      status: 'vacant',
      property_id: propertyId
    })
    if (error) { showToast('Bed ID already exists'); return }
    showToast('Bed added')
    setShowAdd(false)
    setNewBed({ id: '' })
    load()
  }

  const handleBulkAdd = async () => {
    const room = bulkBed.room.trim().toUpperCase()
    const count = parseInt(bulkBed.count)
    const startLetter = (bulkBed.startLetter || 'A').trim().toUpperCase()

    if (!room) { showToast('Enter room number'); return }
    if (!count || count < 1) { showToast('Enter number of beds'); return }
    if (!/^[A-Z]$/.test(startLetter)) { showToast('Start letter must be A–Z'); return }

    // Build the list of proposed bed IDs (stops at Z)
    const startCode = startLetter.charCodeAt(0)
    const proposed = []
    for (let i = 0; i < count; i++) {
      if (startCode + i > 90) break
      proposed.push(`${room}${String.fromCharCode(startCode + i)}`)
    }
    if (proposed.length === 0) { showToast('No beds to add'); return }

    // Check which already exist for this property
    const { data: existing } = await supabase
      .from('beds')
      .select('id')
      .eq('property_id', propertyId)
      .in('id', proposed)

    const existingIds = new Set((existing || []).map(b => b.id))
    const toInsert = proposed.filter(id => !existingIds.has(id))

    if (toInsert.length === 0) {
      showToast('All these beds already exist')
      return
    }

    const rows = toInsert.map(id => ({
      id,
      status: 'vacant',
      property_id: propertyId
    }))

    const { error } = await supabase.from('beds').insert(rows)
    if (error) { showToast('Error: ' + error.message); return }

    const skipped = existingIds.size
    showToast(
      skipped > 0
        ? `Added ${toInsert.length} bed${toInsert.length > 1 ? 's' : ''}, skipped ${skipped} duplicate${skipped > 1 ? 's' : ''}`
        : `Added ${toInsert.length} bed${toInsert.length > 1 ? 's' : ''}`
    )
    setShowAdd(false)
    setBulkBed({ room: '', count: 4, startLetter: 'A' })
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
        {(!isStaff || canAddBeds) && (
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

      {/* Ungrouped beds — grouped by floor and room automatically */}
      {(() => {
        const known = STRUCTURE.flatMap(f => f.rooms)
        const ungrouped = beds.filter(b => !known.includes(b.id.replace(/[A-Z]+$/, '')))
        if (!ungrouped.length) return null

        // Group by room
        const roomMap = ungrouped.reduce((acc, bed) => {
          const room = bed.id.replace(/[A-Z]+$/, '')
          if (!acc[room]) acc[room] = []
          acc[room].push(bed)
          return acc
        }, {})

        // Group rooms by floor (first digit of room number)
        const floorMap = Object.keys(roomMap).reduce((acc, room) => {
          const floorNum = room[0]
          const floorLabel = `Floor ${floorNum}`
          if (!acc[floorLabel]) acc[floorLabel] = []
          acc[floorLabel].push(room)
          return acc
        }, {})

        return Object.entries(floorMap).map(([floorLabel, rooms]) => {
          const floorBeds = rooms.flatMap(r => roomMap[r])
          const floorOcc = floorBeds.filter(b => b.status === 'occupied').length
          return (
            <div key={floorLabel} style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--text)', color: 'white', padding: '10px 16px', borderRadius: 'var(--radius)', marginBottom: 12 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{floorLabel}</span>
                <span style={{ fontSize: 12, opacity: 0.8 }}>{floorOcc}/{floorBeds.length} occupied</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {rooms.map(roomNum => {
                  const roomBeds = roomMap[roomNum]
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
        })
      })()}

      {/* Bed detail modal */}
      {selected && !showVacate && (() => {
        const t = getTenant(selected.id)
        const due = isDue(t)
        const paid = t ? isPaid(t.id) : false
        return (
          <Modal title={`Bed ${selected.id}`} onClose={() => setSelected(null)}
            footer={
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {(!isStaff || canAddBeds) && selected.status === 'vacant' && <button className="btn btn-danger" onClick={handleDeleteBed}>Delete bed</button>}
                {!isStaff && selected.status !== 'vacant' && <button className="btn" onClick={() => { setVacateDate(currentDate()); setShowVacate(true) }}>Mark vacant</button>}
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
                    <span style={{ color: 'var(--text-secondary)' }}>{t.billing_type === 'daily' ? 'Billing' : 'Rent'}</span>
                    <span style={{ fontWeight: 600 }}>{t.billing_type === 'daily' ? 'Daily' : `₹${Number(t.rent).toLocaleString('en-IN')}/mo`}</span>
                  </div>
                  <div className="row-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Rent status</span>
                    {t.billing_type === 'daily'
                      ? (due
                        ? <span className="badge badge-red">{getDailyPendingDays(t)} day{getDailyPendingDays(t) > 1 ? 's' : ''} due</span>
                        : <span className="badge badge-green">Paid up to date</span>)
                      : paid
                      ? <span className="badge badge-green">Paid ✓</span>
                      : due
                      ? <span className="badge badge-red">Due !</span>
                      : <span className="badge badge-amber">Upcoming</span>
                    }
                  </div>

                  {/* Action buttons */}
                  {t.phone && (
                    <div style={{ marginTop: 14 }}>
                      <button
                        onClick={() => openWhatsApp(t)}
                        style={{ width: '100%', background: '#25D366', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', padding: '9px 14px', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit', fontWeight: 500 }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="white">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                        WhatsApp
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="empty" style={{ padding: '20px 0' }}>No tenant assigned</div>
              )}
            </div>
          </Modal>
        )
      })()}

      {/* VACATE MODAL */}
      {showVacate && selected && (() => {
        const t = getTenant(selected.id)
        return (
          <Modal title={t ? `Vacate — ${t.name}` : `Mark bed ${selected.id} vacant`} onClose={() => setShowVacate(false)}
            footer={
              <>
                <button className="btn" onClick={() => setShowVacate(false)}>Cancel</button>
                <button className="btn btn-danger" onClick={handleVacate}>Confirm vacate</button>
              </>
            }>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {t && (
                <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
                  <div className="row-between" style={{ marginBottom: 4 }}><span style={{ color: 'var(--text-secondary)' }}>Tenant</span><span style={{ fontWeight: 500 }}>{t.name}</span></div>
                  <div className="row-between" style={{ marginBottom: 4 }}><span style={{ color: 'var(--text-secondary)' }}>Bed</span><span>{selected.id}</span></div>
                  <div className="row-between"><span style={{ color: 'var(--text-secondary)' }}>Move-in</span><span>{t.movein_date}</span></div>
                </div>
              )}
              {t && (
                <div className="form-group">
                  <label>Vacate date</label>
                  <input type="date" value={vacateDate} onChange={e => setVacateDate(e.target.value)} />
                </div>
              )}
              <div style={{ fontSize: 12, color: 'var(--red)', background: 'var(--red-bg)', padding: '8px 12px', borderRadius: 6 }}>
                This will free up bed {selected.id}{t ? ' and move tenant to vacated history.' : '.'}
              </div>
            </div>
          </Modal>
        )
      })()}

      {/* Add bed modal */}
      {showAdd && (() => {
        // Live preview of bed IDs that will be created in bulk mode
        const previewIds = (() => {
          if (addMode !== 'bulk') return []
          const room = bulkBed.room.trim().toUpperCase()
          const count = parseInt(bulkBed.count)
          const startLetter = (bulkBed.startLetter || 'A').trim().toUpperCase()
          if (!room || !count || count < 1 || !/^[A-Z]$/.test(startLetter)) return []
          const startCode = startLetter.charCodeAt(0)
          const ids = []
          for (let i = 0; i < count; i++) {
            if (startCode + i > 90) break
            ids.push(`${room}${String.fromCharCode(startCode + i)}`)
          }
          return ids
        })()

        // Which of those already exist (so user sees what'll be skipped)
        const existingSet = new Set(beds.map(b => b.id))
        const willSkip = previewIds.filter(id => existingSet.has(id))
        const willAdd = previewIds.filter(id => !existingSet.has(id))

        return (
          <Modal title="Add beds" onClose={() => setShowAdd(false)}
            footer={
              <>
                <button className="btn" onClick={() => setShowAdd(false)}>Cancel</button>
                {addMode === 'single'
                  ? <button className="btn btn-primary" onClick={handleAddBed}>Add bed</button>
                  : <button className="btn btn-primary" onClick={handleBulkAdd} disabled={willAdd.length === 0}>
                      Add {willAdd.length > 0 ? `${willAdd.length} bed${willAdd.length > 1 ? 's' : ''}` : 'beds'}
                    </button>
                }
              </>
            }>

            {/* Mode toggle */}
            <div style={{ display: 'flex', gap: 4, background: 'var(--bg)', padding: 3, borderRadius: 'var(--radius-sm)', marginBottom: 16 }}>
              <button
                onClick={() => setAddMode('single')}
                style={{
                  flex: 1, padding: '6px 10px', fontSize: 12, fontWeight: 600,
                  background: addMode === 'single' ? 'var(--surface)' : 'transparent',
                  color: 'var(--text)', border: 'none', borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer', fontFamily: 'inherit',
                  boxShadow: addMode === 'single' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'
                }}>
                Single bed
              </button>
              <button
                onClick={() => setAddMode('bulk')}
                style={{
                  flex: 1, padding: '6px 10px', fontSize: 12, fontWeight: 600,
                  background: addMode === 'bulk' ? 'var(--surface)' : 'transparent',
                  color: 'var(--text)', border: 'none', borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer', fontFamily: 'inherit',
                  boxShadow: addMode === 'bulk' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'
                }}>
                Bulk add
              </button>
            </div>

            {addMode === 'single' ? (
              <div className="form-grid">
                <div className="form-group"><label>Bed ID</label>
                  <input placeholder="e.g. 101E" value={newBed.id} onChange={e => setNewBed(p => ({ ...p, id: e.target.value }))} />
                </div>
              </div>
            ) : (
              <div className="form-grid">
                <div className="form-group"><label>Room number</label>
                  <input placeholder="e.g. 101" value={bulkBed.room}
                    onChange={e => setBulkBed(p => ({ ...p, room: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Number of beds</label>
                    <input type="number" min="1" max="26" value={bulkBed.count}
                      onChange={e => setBulkBed(p => ({ ...p, count: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Start from letter</label>
                    <input maxLength="1" placeholder="A" value={bulkBed.startLetter}
                      onChange={e => setBulkBed(p => ({ ...p, startLetter: e.target.value.toUpperCase() }))} />
                  </div>
                </div>

                {/* Live preview */}
                {previewIds.length > 0 && (
                  <div style={{ background: 'var(--bg)', padding: 10, borderRadius: 'var(--radius-sm)', marginTop: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>
                      Will create
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {previewIds.map(id => {
                        const isDup = existingSet.has(id)
                        return (
                          <span key={id} style={{
                            fontSize: 12, padding: '2px 8px', borderRadius: 4, fontWeight: 500,
                            background: isDup ? 'var(--border)' : 'var(--green-bg, #e6f7ec)',
                            color: isDup ? 'var(--text-tertiary)' : 'var(--green, #12784f)',
                            textDecoration: isDup ? 'line-through' : 'none'
                          }}>
                            {id}
                          </span>
                        )
                      })}
                    </div>
                    {willSkip.length > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
                        {willSkip.length} already exist{willSkip.length > 1 ? '' : 's'}, will be skipped
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </Modal>
        )
      })()}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
