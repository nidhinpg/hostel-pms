import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const fmt = n => '₹' + Number(n).toLocaleString('en-IN')

export default function Dashboard({ onNavigate }) {
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const now = new Date()
    const month = now.toISOString().slice(0, 7)

    const [bedsRes, txRes, recentRes] = await Promise.all([
      supabase.from('beds').select('status'),
      supabase.from('transactions').select('type,amount').gte('date', month + '-01'),
      supabase.from('transactions').select('*').order('date', { ascending: false }).limit(6),
    ])

    const beds = bedsRes.data || []
    const tx = txRes.data || []
    const occupied = beds.filter(b => b.status === 'occupied').length
    const income = tx.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0)
    const expense = tx.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0)

    setStats({ total: beds.length, occupied, income, expense })
    setRecent(recentRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="loading">Loading dashboard...</div>

  const { total, occupied, income, expense } = stats

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

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span className="section-title">Bed utilization</span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{occupied} of {total} beds</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: total ? (occupied / total * 100) + '%' : '0%' }} />
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="row-between" style={{ marginBottom: 14 }}>
          <span className="card-title" style={{ margin: 0 }}>Recent transactions</span>
          <button className="btn" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => onNavigate('finance')}>View all</button>
        </div>
        {recent.length === 0 ? (
          <div className="empty">No transactions yet</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th></tr>
              </thead>
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
