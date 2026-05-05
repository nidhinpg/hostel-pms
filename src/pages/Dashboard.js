import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const fmt = n => '₹' + Number(n).toLocaleString('en-IN')

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function getMonthRange(month) {
  const [year, mon] = month.split('-').map(Number)
  const start = `${month}-01`
  const lastDay = new Date(year, mon, 0).getDate()
  const end = `${month}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

// Tenant is "due" only if today >= their movein day AND not paid
function isTenantDue(tenant, paidIds) {
  if (paidIds.includes(tenant.id)) return false
  const todayDay = new Date().getDate()
  const joinDay = tenant.movein_date ? parseInt(tenant.movein_date.split('-')[2]) : 1
  return todayDay >= joinDay - 1  // show 1 day before due date
}

export default function Dashboard({ onNavigate, propertyId }) {
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])
  const [dueTenants, setDueTenants] = useState([])
  const [endingSoon, setEndingSoon] = useState([])
  const [upcomingCount, setUpcomingCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const month = currentMonth()
    const { start, end } = getMonthRange(month)

    const [bedsRes, txRes, recentRes, tenantsRes, paymentsRes, endingSoonRes] = await Promise.all([
      supabase.from('beds').select('status').eq('property_id', propertyId),
      supabase.from('transactions').select('type,amount').eq('property_id', propertyId).gte('date', start).lte('date', end),
      supabase.from('transactions').select('*').eq('property_id', propertyId).order('date', { ascending: false }).limit(6),
      supabase.from('tenants').select('*').eq('property_id', propertyId).eq('status', 'active'),
      supabase.from('rent_payments').select('tenant_id').eq('property_id', propertyId).eq('month', month),
      supabase.from('rent_payments').select('tenant_id, stay_end_date, days_paid').eq('property_id', propertyId).eq('month', month).not('stay_end_date', 'is', null),
    ])

    const beds = bedsRes.data || []
    const tx = txRes.data || []
    const tenants = tenantsRes.data || []
    const paidIds = (paymentsRes.data || []).map(p => p.tenant_id)

    const occupied = beds.filter(b => b.status === 'occupied').length
    const income = tx.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0)
    const expense = tx.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0)

    // Only tenants whose rent day has passed
    const due = tenants.filter(t => isTenantDue(t, paidIds))
    const upcoming = tenants.filter(t => !paidIds.includes(t.id) && !isTenantDue(t, paidIds))
    const paidCount = paidIds.length

    // Find tenants whose stay ends in 3 days or less
    const today = new Date()
    const endingSoon = []
    for (const rp of endingSoonRes.data || []) {
      if (!rp.stay_end_date) continue
      const end = new Date(rp.stay_end_date)
      const diff = Math.ceil((end - today) / (1000 * 60 * 60 * 24))
      if (diff <= 3) {
        const tenant = tenants.find(t => t.id === rp.tenant_id)
        if (tenant) endingSoon.push({ ...tenant, stay_end_date: rp.stay_end_date, days_left: diff })
      }
    }

    setStats({ total: beds.length, occupied, income, expense, totalTenants: tenants.length, paidCount })
    setEndingSoon(endingSoon)
    setRecent(recentRes.data || [])
    setDueTenants(due)
    setUpcomingCount(upcoming.length)
    setLoading(false)
  }, [propertyId])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="loading">Loading dashboard...</div>

  const { total, occupied, income, expense, totalTenants, paidCount } = stats
  const month = currentMonth()

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
        </span>
      </div>

      <div className="metrics">
        <div className="metric">
          <div className="metric-label">Occupancy</div>
          <div className="metric-value">{occupied}/{total}</div>
          <div className="metric-sub">{total ? Math.round(occupied / total * 100) : 0}% occupied</div>
        </div>
        <div className="metric">
          <div className="metric-label">Month income</div>
          <div className="metric-value" style={{ color: 'var(--green)' }}>{fmt(income)}</div>
          <div className="metric-sub">This month</div>
        </div>
        <div className="metric">
          <div className="metric-label">Month expenses</div>
          <div className="metric-value" style={{ color: 'var(--red)' }}>{fmt(expense)}</div>
          <div className="metric-sub">This month</div>
        </div>
        <div className="metric">
          <div className="metric-label">Net profit</div>
          <div className="metric-value" style={{ color: income - expense >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {fmt(income - expense)}
          </div>
          <div className="metric-sub">P&amp;L this month</div>
        </div>
      </div>

      {/* Rent collection card */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row-between" style={{ marginBottom: 14 }}>
          <span className="card-title" style={{ margin: 0 }}>Rent collection — {month}</span>
          <button className="btn" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => onNavigate('tenants')}>
            Collect rent
          </button>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: dueTenants.length > 0 ? 14 : 0, flexWrap: 'wrap' }}>
          <div onClick={() => onNavigate('tenants', 'paid')} style={{ flex: 1, minWidth: 80, background: 'var(--green-bg)', borderRadius: 8, padding: '12px 14px', textAlign: 'center', cursor: 'pointer' }}>
            <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--green)' }}>{paidCount}</div>
            <div style={{ fontSize: 12, color: 'var(--green)', marginTop: 2 }}>Paid ↗</div>
          </div>
          <div onClick={() => onNavigate('tenants', 'due')} style={{ flex: 1, minWidth: 80, background: 'var(--red-bg)', borderRadius: 8, padding: '12px 14px', textAlign: 'center', cursor: 'pointer' }}>
            <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--red)' }}>{dueTenants.length}</div>
            <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 2 }}>Due ↗</div>
          </div>
          <div onClick={() => onNavigate('tenants', 'upcoming')} style={{ flex: 1, minWidth: 80, background: 'var(--amber-bg)', borderRadius: 8, padding: '12px 14px', textAlign: 'center', cursor: 'pointer' }}>
           <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--amber)' }}>{Math.max(0, upcomingCount)}</div>
            <div style={{ fontSize: 12, color: 'var(--amber)', marginTop: 2 }}>Upcoming ↗</div>
          </div>
          <div style={{ flex: 1, minWidth: 80, background: 'var(--bg)', borderRadius: 8, padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)' }}>
              {fmt(dueTenants.reduce((a, t) => a + t.rent, 0))}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Outstanding</div>
          </div>
        </div>

        {/* Only show actually due tenants */}
        {dueTenants.length > 0 && (
          <>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Rent overdue
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {dueTenants.map(t => {
                const joinDay = t.movein_date ? parseInt(t.movein_date.split('-')[2]) : 1
                return (
                  <div key={t.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'var(--red-bg)', borderRadius: 6,
                    padding: '5px 10px', fontSize: 12
                  }}>
                    <span style={{ fontWeight: 500, color: 'var(--red)' }}>{t.name.split(' ')[0]}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{t.bed_id}</span>
                    <span style={{ color: 'var(--red)', fontWeight: 600 }}>{fmt(t.rent)}</span>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>due {joinDay}th</span>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {dueTenants.length === 0 && upcomingCount === 0 && totalTenants > 0 && (
          <div style={{ textAlign: 'center', padding: '10px 0', color: 'var(--green)', fontSize: 13, fontWeight: 500 }}>
            ✓ All tenants paid for {month}!
          </div>
        )}

        {dueTenants.length === 0 && upcomingCount > 0 && (
          <div style={{ textAlign: 'center', padding: '10px 0', color: 'var(--amber)', fontSize: 13, fontWeight: 500 }}>
            No overdue rents — {upcomingCount} tenant{upcomingCount > 1 ? 's' : ''} upcoming
          </div>
        )}
      </div>

      {/* Bed utilization */}
      {/* Stay ending alerts */}
      {endingSoon.length > 0 && (
        <div style={{ background: 'var(--red-bg)', border: '1px solid #f5c0c0', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--red)', marginBottom: 10 }}>
            ⚠ Stay ending soon — {endingSoon.length} tenant{endingSoon.length > 1 ? 's' : ''}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {endingSoon.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'white', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{t.name}</span>
                  <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>{t.bed_id}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {t.days_left < 0
                    ? <span style={{ color: 'var(--red)', fontWeight: 600 }}>Ended {Math.abs(t.days_left)}d ago</span>
                    : t.days_left === 0
                    ? <span style={{ color: 'var(--red)', fontWeight: 600 }}>Ends TODAY</span>
                    : <span style={{ color: 'var(--amber)', fontWeight: 600 }}>{t.days_left} day{t.days_left > 1 ? 's' : ''} left</span>
                  }
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>till {t.stay_end_date}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span className="section-title">Bed utilization</span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{occupied} of {total} beds</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: total ? (occupied / total * 100) + '%' : '0%' }} />
        </div>
      </div>

      {/* Recent transactions */}
      <div className="card">
        <div className="row-between" style={{ marginBottom: 14 }}>
          <span className="card-title" style={{ margin: 0 }}>Recent transactions</span>
          <button className="btn" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => onNavigate('finance')}>View all</button>
        </div>
        {recent.length === 0 ? (
          <div className="empty">No transactions yet</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th></tr></thead>
              <tbody>
                {recent.map(t => (
                  <tr key={t.id}>
                    <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{t.date}</td>
                    <td>{t.description}</td>
                    <td><span className="badge badge-blue">{t.category}</span></td>
                    <td className={t.type === 'income' ? 'amt-income' : 'amt-expense'}>
                      {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
