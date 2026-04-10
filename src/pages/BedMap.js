import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'

const STRUCTURE = [
  { floor: 'Floor 1', rooms: ['101', '102', '103', '104'] },
  { floor: 'Floor 2', rooms: ['201', '202', '203', '204', '205'] },
  { floor: 'Floor 3', rooms: ['301', '302', '303', '304'] }
]

export default function BedMap({ propertyId }) {
  const [beds, setBeds] = useState([])
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newBed, setNewBed] = useState({ id: '', status: 'vacant' })
  const [toast, setToast] = useState('')

  const load = useCallback(async () => {
    const [b, t] = await Promise.all([
      supabase.from('beds').select('*').eq('property_id', propertyId).order('id'),
      supabase.from('tenants').select('*').eq('property_id', propertyId).eq('status', 'active'),
    ])
    setBeds(b.data || [])
    setTenants(t.data || [])
    setLoading(false)
  }, [propertyId])

  useEffect(() => { load() }, [load])

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 2500) }
  const getTenant = bedId => tenants.find(t => t.bed_id === bedId)

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
    await supabase.from('beds').delete().eq('id', selected.id).eq('property_id', propertyId)
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

  if (loading) return <div className="loading">Loading beds...</div>

  const occupied = beds.filter(b => b.status === 'occupied').length
  const vacant = beds.filter(b => b.status === 'vacant').length
  const maintenance = beds.filter(b => b.status === 'maintenance').length

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Bed map</h1>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add bed</button>
      </div>

      <div className="legend">
        <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--green)' }} />{occupied} Occupied</div>
        <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--border-strong)' }} />{vacant} Vacant</div>
        <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--amber)' }} />{maintenance} Maintenance</div>
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
                      {roomBeds.map(bed => {
                        const t = getTenant(bed.id)
                        return (
                          <div key={bed.id} className={`bed-card ${bed.status}`} onClick={() => setSelected(bed)} style={{ minWidth: 72, flex: '0 0 auto' }}>
                            <span className="bed-num">{bed.id}</span>
                            <span className="bed-name">{bed.status === 'occupied' && t ? t.name.split(' ')[0] : bed.status === 'maintenance' ? 'Maint.' : 'Free'}</span>
                          </div>
                        )
                      })}
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
              {ungrouped.map(bed => {
                const t = getTenant(bed.id)
                return (
                  <div key={bed.id} className={`bed-card ${bed.status}`} onClick={() => setSelected(bed)} style={{ minWidth: 72 }}>
                    <span className="bed-num">{bed.id}</span>
                    <span className="bed-name">{bed.status === 'occupied' && t ? t.name.split(' ')[0] : bed.status === 'maintenance' ? 'Maint.' : 'Free'}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {selected && (() => {
        const t = getTenant(selected.id)
        return (
          <Modal title={`Bed ${selected.id}`} onClose={() => setSelected(null)}
            footer={
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button className="btn btn-danger" onClick={handleDeleteBed}>Delete bed</button>
                {selected.status !== 'vacant' && <button className="btn" onClick={() => handleSetStatus('vacant')}>Mark vacant</button>}
                {selected.status !== 'maintenance' && <button className="btn" onClick={() => handleSetStatus('maintenance')}>Mark maintenance</button>}
                {selected.status === 'maintenance' && <button className="btn btn-primary" onClick={() => handleSetStatus('vacant')}>Back to vacant</button>}
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
                  <div className="row-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}><span style={{ color: 'var(--text-secondary)' }}>Tenant</span><span style={{ fontWeight: 500 }}>{t.name}</span></div>
                  <div className="row-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}><span style={{ color: 'var(--text-secondary)' }}>Phone</span><span>{t.phone}</span></div>
                  <div className="row-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}><span style={{ color: 'var(--text-secondary)' }}>Move-in</span><span>{t.movein_date}</span></div>
                  <div className="row-between" style={{ padding: '8px 0' }}><span style={{ color: 'var(--text-secondary)' }}>Rent</span><span style={{ fontWeight: 600 }}>₹{Number(t.rent).toLocaleString('en-IN')}/mo</span></div>
                </>
              ) : (
                <div className="empty" style={{ padding: '20px 0' }}>No tenant assigned</div>
              )}
            </div>
          </Modal>
        )
      })()}

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
