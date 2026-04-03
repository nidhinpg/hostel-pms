import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const fmt = n => '₹' + Number(n).toLocaleString('en-IN')

export default function Reports() {
  const [data, setData] = useState(null)
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [txRes, bedsRes, tenantsRes] = await Promise.all([
      supabase.from('transactions').select('*').gte('date', month + '-01').lte('date', month + '-31'),
      supabase.from('beds').select('status'),
      supabase.from('tenants').select('rent').eq('status', 'active'),
    ])

    const tx = txRes.data || []
    const beds = bedsRes.data || []
    const tenants = tenantsRes.data || []

    const income = tx.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0)
    const expense = tx.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0)
    const occupied = beds.filter(b => b.status === 'occupied').length
    const totalBeds = beds.length
    const potentialRent = tenants.reduce((a, t) => a + t.rent, 0)

    const catMap = {}
    tx.filter(t => t.type === 'expense').forEach(t => {
      catMap[t.category] = (catMap[t.category] || 0) + t.amount
    })

    setData({ income, expense, net: income - expense, occupied, totalBeds, potentialRent, catMap })
    setLoading(false)
  }, [month])

  useEffect(() => { load() }, [load])

  const months = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(); d.setMonth(d.getMonth() - i)
    months.push(d.toISOString().slice(0, 7))
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Reports</h1>
        <select value={month} onChange={e => setMonth(e.target.value)} style={{ fontSize: 13, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text)' }}>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {loading || !data ? <div className="loading">Loading report...</div> : (
        <>
          <div className="metrics">
            <div className="metric">
              <div className="metric-label">Total income</div>
              <div className="metric-value" style={{ color: 'var(--green)' }}>{fmt(data.income)}</div>
              <div className="metric-sub">{month}</div>
            </div>
            <div className="metric">
              <div className="metric-label">Total expenses</div>
              <div className="metric-value" style={{ color: 'var(--red)' }}>{fmt(data.expense)}</div>
              <div className="metric-sub">{month}</div>
            </div>
            <div className="metric">
              <div className="metric-label">Net profit</div>
              <div className="metric-value" style={{ color: data.net >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(data.net)}</div>
              <div className="metric-sub">P&amp;L</div>
            </div>
            <div className="metric">
              <div className="metric-label">Collection rate</div>
              <div className="metric-value">
                {data.potentialRent > 0 ? Math.round(data.income / data.potentialRent * 100) : 0}%
              </div>
              <div className="metric-sub">vs potential {fmt(data.potentialRent)}</div>
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <div className="row-between" style={{ marginBottom: 8 }}>
              <span className="section-title">Bed utilization</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{data.occupied}/{data.totalBeds} beds</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: data.totalBeds ? (data.occupied / data.totalBeds * 100) + '%' : '0%' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
              {data.totalBeds ? Math.round(data.occupied / data.totalBeds * 100) : 0}% occupancy rate
            </div>
          </div>

          <div className="card">
            <div className="card-title">Expense breakdown</div>
            {Object.keys(data.catMap).length === 0 ? (
              <div className="empty">No expenses this month</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Category</th><th>Amount</th><th>% of expenses</th><th>Bar</th></tr></thead>
                  <tbody>
                    {Object.entries(data.catMap).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                      <tr key={cat}>
                        <td>{cat}</td>
                        <td style={{ fontWeight: 600 }}>{fmt(amt)}</td>
                        <td>{data.expense ? Math.round(amt / data.expense * 100) : 0}%</td>
                        <td style={{ width: 100 }}>
                          <div className="progress-bar">
                            <div className="progress-fill" style={{ width: data.expense ? (amt / data.expense * 100) + '%' : '0%', background: 'var(--red)' }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
