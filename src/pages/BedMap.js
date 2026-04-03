import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'

export default function BedMap() {
  const [beds, setBeds] = useState([])
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newBed, setNewBed] = useState({ id: '', status: 'vacant' })
  const [toast, setToast] = useState('')

  const load = useCallback(async () => {
    const [b, t] = await Promise.all([
      supabase.from('beds').select('*').order('id'),
      supabase.from('tenants').select('*').eq('status', 'active'),
    ])
    setBeds(b.data || [])
    setTenants(t.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const getTenant = bedId => tenants.find(t => t.bed_id === bedId)

  const handleVacate = async () => {
    await supabase.from('beds').update({ status: 'vacant' }).eq('id', selected.id)
    const t = getTenant(selected.id)
    if (t) await supabase.from('tenants').update({ status: 'vacated' }).eq('id', t.id)
    showToast('Bed vacated')
    setSelected(null)
    load()
  }

  const handleMaintenance = async () => {
    await supabase.from('beds').update({ status: 'maintenance' }).eq('id', selected.id)
    showToast('Marked as maintenance')
    setSelected(null)
    load()
  }

  const handleAddBed = async () => {
    if (!newBed.id.trim()) return
    const { error } = await supabase.from('beds').insert({ id: newBed.id.trim().toUpperCase(), status: newBed.status })
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

      <div className="bed-grid">
        {beds.map(bed => {
          const t = getTenant(bed.id)
          return (
            <div key={bed.id} className={`bed-card ${bed.status}`} onClick={() => setSelected(bed)}>
              <span className="bed-num">{bed.id}</span>
              <span className="bed-name">
                {bed.status === 'occupied' && t ? t.name.split(' ')[0] :
                  bed.status === 'maintenance' ? 'Maint.' : 'Free'}
              </span>
            </div>
          )
        })}
      </div>

      {selected && (
        <Modal title={`Bed ${selected.id}`} onClose={() => setSelected(null)}
          footer={
            <>
              <button className="btn" onClick={() => setSelected(null)}>Close</button>
              {selected.status !== 'maintenance' && (
                <button className="btn" onClick={handleMaintenance}>Mark maintenance</button>
              )}
              {selected.status === 'occupied' && (
                <button className="btn btn-danger" onClick={handleVacate}>Vacate bed</button>
              )}
            </>
          }>
          {(() => {
            const t = getTenant(selected.id)
            return (
              <div style={{ fontSize: 13 }}>
                <div className="row-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Status</span>
                  <span className={`badge ${selected.status === 'occupied' ? 'badge-green' : selected.status === 'maintenance' ? 'badge-amber' : 'badge-blue'}`}>
                    {selected.status}
                  </span>
                </div>
                {t ? (
                  <>
                    <div className="row-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Tenant</span><span>{t.name}</span>
                    </div>
                    <div className="row-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Phone</span><span>{t.phone}</span>
                    </div>
                    <div className="row-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Move-in</span><span>{t.movein_date}</span>
                    </div>
                    <div className="row-between" style={{ padding: '8px 0' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Rent</span>
                      <span style={{ fontWeight: 600 }}>₹{Number(t.rent).toLocaleString('en-IN')}/mo</span>
                    </div>
                  </>
                ) : (
                  <div className="empty" style={{ padding: '20px 0' }}>No tenant assigned</div>
                )}
              </div>
            )
          })()}
        </Modal>
      )}

      {showAdd && (
        <Modal title="Add new bed" onClose={() => setShowAdd(false)}
          footer={
            <>
              <button className="btn" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddBed}>Add bed</button>
            </>
          }>
          <div className="form-grid">
            <div className="form-group">
              <label>Bed ID</label>
              <input placeholder="e.g. D1" value={newBed.id} onChange={e => setNewBed(p => ({ ...p, id: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Initial status</label>
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
