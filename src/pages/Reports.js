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

export default function Reports({ propertyId }) {
  const [data, setData] = useState(null)
  const [month, setMonth] = useState(currentMonth)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { start, end } = getMonthRange(month)
    const [txRes, bedsRes, tenantsRes] = await Promise.all([
      supabase.from('transactions').select('*').eq('property_id', propertyId).gte('date', start).lte('date', end),
      supabase.from('beds').select('status').eq('property_id', propertyId),
      supabase.from('tenants').select('rent').eq('property_id', propertyId).eq('status', 'active'),
    ])
    const tx = txRes.data || []
    const beds = bedsRes.data || []
    const tenants = tenantsRes.data || []
    const income = tx.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0)
    const expense = tx.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0)
    const occupied = beds.filter(b => b.status === 'occupied').length
    const potentialRent = tenants.reduce((a, t) => a + t.rent, 0)
    const catMap = {}
    tx.filter(t => t.type === 'expense').forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount })
    const incCatMap = {}
    tx.filter(t => t.type === 'income').forEach(t => { incCatMap[t.category] = (incCatMap[t.category] || 0) + t.amount })
    setData({ income, expense, net: income - expense, occupied, totalBeds: beds.length, potentialRent, catMap, incCatMap, txCount: tx.length })
    setLoading(false)
  }, [month, propertyId])

  useEffect(() => { load() }, [load])

  const months = []
  for (let i = 0; i < 12; i++) {
    const now = new Date()
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    months.push(`${date.getFullYear()}-${mm}`)
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Reports</h1>
        <select value={month} onChange={e => setMonth(e.target.value)}
          style={{ fontSize: 13, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text)' }}>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {loading || !data ? <div className="loading">Loading report...</div> : (
        <>
          {data.txCount === 0 && (
            <div style={{ background: 'var(--amber-bg)', color: 'var(--amber)', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
              No transactions found for {month}.
            </div>
          )}
          <div className="metrics">
            <div className="metric"><div className="metric-label">Total income</div><div className="metric-value" style={{ color: 'var(--green)' }}>{fmt(data.income)}</div><div className="metric-sub">{month}</div></div>
            <div className="metric"><div className="metric-label">Total expenses</div><div className="metric-value" style={{ color: 'var(--red)' }}>{fmt(data.expense)}</div><div className="metric-sub">{month}</div></div>
            <div className="metric"><div className="metric-label">Net profit</div><div className="metric-value" style={{ color: data.net >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(data.net)}</div><div className="metric-sub">P&amp;L</div></div>
            <div className="metric"><div className="metric-label">Collection rate</div><div className="metric-value">{data.potentialRent > 0 ? Math.round(data.income / data.potentialRent * 100) : 0}%</div><div className="metric-sub">vs potential {fmt(data.potentialRent)}</div></div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <div className="row-between" style={{ marginBottom: 8 }}>
              <span className="section-title">Bed utilization</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{data.occupied}/{data.totalBeds} beds</span>
            </div>
            <div className="progress-bar"><div className="progress-fill" style={{ width: data.totalBeds ? (data.occupied / data.totalBeds * 100) + '%' : '0%' }} /></div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{data.totalBeds ? Math.round(data.occupied / data.totalBeds * 100) : 0}% occupancy rate</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div className="card">
              <div className="card-title">Income breakdown</div>
              {Object.keys(data.incCatMap).length === 0 ? <div className="empty">No income</div> : (
                <table><thead><tr><th>Category</th><th>Amount</th></tr></thead>
                  <tbody>{Object.entries(data.incCatMap).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                    <tr key={cat}><td>{cat}</td><td className="amt-income">{fmt(amt)}</td></tr>
                  ))}</tbody>
                </table>
              )}
            </div>
            <div className="card">
              <div className="card-title">Expense breakdown</div>
              {Object.keys(data.catMap).length === 0 ? <div className="empty">No expenses</div> : (
                <table><thead><tr><th>Category</th><th>Amount</th><th>%</th></tr></thead>
                  <tbody>{Object.entries(data.catMap).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                    <tr key={cat}><td>{cat}</td><td className="amt-expense">{fmt(amt)}</td><td style={{ color: 'var(--text-secondary)' }}>{data.expense ? Math.round(amt / data.expense * 100) : 0}%</td></tr>
                  ))}</tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
