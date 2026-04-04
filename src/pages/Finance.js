import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'

const fmt = n => '₹' + Number(n).toLocaleString('en-IN')
const CATEGORIES = ['Rent', 'Advance', 'Electricity', 'Water', 'Maintenance', 'Groceries', 'Salary', 'Internet', 'Other']

function getMonthRange(month) {
  const [year, mon] = month.split('-').map(Number)
  const start = `${month}-01`
  const lastDay = new Date(year, mon, 0).getDate()
  const end = `${month}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

export default function Finance() {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [toast, setToast] = useState('')
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: 'income', category: 'Rent', description: '', amount: ''
  })

  const load = useCallback(async () => {
    setLoading(true)
    const { start, end } = getMonthRange(month)
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false })
    if (error) console.error('Finance load error:', error)
    setTransactions(data || [])
    setLoading(false)
  }, [month])

  useEffect(() => { load() }, [load])

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const handleAdd = async () => {
    if (!form.amount) { showToast('Enter amount'); return }
    const { error } = await supabase.from('transactions').insert({
      date: form.date,
      type: form.type,
      category: form.category,
      description: form.description,
      amount: parseInt(form.amount)
    })
    if (error) { showToast('Error: ' + error.message); return }
    showToast('Entry saved!')
    setShowAdd(false)
    setForm({ date: new Date().toISOString().slice(0, 10), type: 'income', category: 'Rent', description: '', amount: '' })
    load()
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this transaction?')) return
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) { showToast('Error deleting'); return }
    showToast('Deleted')
    load()
  }

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const income = transactions.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0)
  const expense = transactions.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0)

  const months = []
  for (let i = 0; i < 12; i++) {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    months.push(d.toISOString().slice(0, 7))
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Income & expenses</h1>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add entry</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Month:</label>
        <select value={month} onChange={e => setMonth(e.target.value)}
          style={{ fontSize: 13, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text)' }}>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div className="summary-pills">
        <span className="pill" style={{ background: 'var(--green-bg)', color: 'var(--green)' }}>
          Income: {fmt(income)}
        </span>
        <span className="pill" style={{ background: 'var(--red-bg)', color: 'var(--red)' }}>
          Expenses: {fmt(expense)}
        </span>
        <span className="pill" style={{
          background: income - expense >= 0 ? 'var(--green-bg)' : 'var(--red-bg)',
          color: income - expense >= 0 ? 'var(--green)' : 'var(--red)'
        }}>
          Net: {fmt(income - expense)}
        </span>
        <span className="pill" style={{ background: 'var(--blue-bg)', color: 'var(--blue)' }}>
          {transactions.length} entries
        </span>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading">Loading...</div>
        ) : transactions.length === 0 ? (
          <div className="empty">
            No entries for {month}.<br />
            <span style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
              Click "+ Add entry" to record income or expenses.
            </span>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(t => (
                  <tr key={t.id}>
                    <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{t.date}</td>
                    <td>
                      <span className={`badge ${t.type === 'income' ? 'badge-green' : 'badge-red'}`}>
                        {t.type}
                      </span>
                    </td>
                    <td><span className="badge badge-blue">{t.category}</span></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{t.description || '—'}</td>
                    <td style={{ textAlign: 'right' }}
                      className={t.type === 'income' ? 'amt-income' : 'amt-expense'}>
                      {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
                    </td>
                    <td>
                      <button onClick={() => handleDelete(t.id)}
                        title="Delete"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 18, padding: '0 4px', lineHeight: 1 }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}>
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdd && (
        <Modal title="Add entry" onClose={() => setShowAdd(false)}
          footer={
            <>
              <button className="btn" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAdd}>Save</button>
            </>
          }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-grid">
              <div className="form-group">
                <label>Date</label>
                <input type="date" value={form.date} onChange={f('date')} />
              </div>
              <div className="form-group">
                <label>Type</label>
                <select value={form.type} onChange={f('type')}>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label>Category</label>
                <select value={form.category} onChange={f('category')}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Amount (₹)</label>
                <input type="number" placeholder="0" value={form.amount} onChange={f('amount')} />
              </div>
            </div>
            <div className="form-grid single">
              <div className="form-group">
                <label>Description (optional)</label>
                <input placeholder="e.g. Rahul - April rent" value={form.description} onChange={f('description')} />
              </div>
            </div>
          </div>
        </Modal>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
