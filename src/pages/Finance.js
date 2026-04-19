import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'

const fmt = n => '₹' + Number(n).toLocaleString('en-IN')
const INCOME_CATEGORIES = ['Rent', 'Daily rent', 'Advance', 'Food', 'Other income']
const EXPENSE_CATEGORIES = ['Electricity', 'Water', 'Maintenance', 'Groceries', 'Salary', 'Internet', 'Petrol', 'Other']
const ALL_CATEGORIES = ['All', ...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES]

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

export default function Finance({ propertyId, isStaff = false }) {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [toast, setToast] = useState('')
  const [month, setMonth] = useState(currentMonth)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all') // all | income | expense
  const [filterCat, setFilterCat] = useState('All')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: 'income', category: 'Rent', description: '', amount: ''
  })

  const handleTypeChange = (newType) => {
    const defaultCat = newType === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]
    setForm(p => ({ ...p, type: newType, category: defaultCat }))
  }

  const load = useCallback(async () => {
    setLoading(true)
    const { start, end } = getMonthRange(month)
    const { data } = await supabase
      .from('transactions').select('*')
      .eq('property_id', propertyId)
      .gte('date', start).lte('date', end)
      .order('date', { ascending: false })
    setTransactions(data || [])
    setLoading(false)
  }, [month, propertyId])

  useEffect(() => { load() }, [load])

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const handleAdd = async () => {
    if (!form.amount) { showToast('Enter amount'); return }
    const { error } = await supabase.from('transactions').insert({
      date: form.date, type: form.type, category: form.category,
      description: form.description, amount: parseInt(form.amount),
      property_id: propertyId
    })
    if (error) { showToast('Error: ' + error.message); return }
    showToast('Entry saved!')
    setShowAdd(false)
    setForm({ date: new Date().toISOString().slice(0, 10), type: 'income', category: 'Rent', description: '', amount: '' })
    load()
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this transaction?')) return
    await supabase.from('transactions').delete().eq('id', id)
    showToast('Deleted')
    load()
  }

  const clearFilters = () => {
    setSearch('')
    setFilterType('all')
    setFilterCat('All')
    setDateFrom('')
    setDateTo('')
  }

  const hasActiveFilters = search || filterType !== 'all' || filterCat !== 'All' || dateFrom || dateTo

  // Apply all filters locally
  const filtered = transactions.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false
    if (filterCat !== 'All' && t.category !== filterCat) return false
    if (dateFrom && t.date < dateFrom) return false
    if (dateTo && t.date > dateTo) return false
    if (search) {
      const q = search.toLowerCase()
      return (t.description || '').toLowerCase().includes(q) ||
        (t.category || '').toLowerCase().includes(q) ||
        String(t.amount).includes(q)
    }
    return true
  })

  const income = filtered.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0)
  const expense = filtered.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0)

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

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
        <h1 className="page-title">Income & expenses</h1>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add entry</button>
      </div>

      {/* Month selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Month:</label>
        <select value={month} onChange={e => setMonth(e.target.value)}
          style={{ fontSize: 13, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text)' }}>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Search bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', fontSize: 14, pointerEvents: 'none' }}>🔍</span>
          <input
            placeholder="Search by name, description or amount..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '9px 12px 9px 32px',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              fontSize: 13, fontFamily: 'inherit',
              background: 'var(--surface)', color: 'var(--text)'
            }}
          />
          {search && (
            <button onClick={() => setSearch('')}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 16 }}>×</button>
          )}
        </div>
        <button className={`btn ${showFilters ? 'btn-primary' : ''}`}
          onClick={() => setShowFilters(!showFilters)}
          style={{ fontSize: 12, padding: '8px 14px', whiteSpace: 'nowrap', position: 'relative' }}>
          Filters {hasActiveFilters && <span style={{ position: 'absolute', top: -4, right: -4, width: 8, height: 8, background: 'var(--red)', borderRadius: '50%' }} />}
        </button>
        {hasActiveFilters && (
          <button className="btn" onClick={clearFilters} style={{ fontSize: 12, padding: '8px 12px', color: 'var(--red)', whiteSpace: 'nowrap' }}>
            Clear all
          </button>
        )}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 14, marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Type</label>
              <select value={filterType} onChange={e => setFilterType(e.target.value)}
                style={{ fontSize: 13, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text)', width: '100%' }}>
                <option value="all">All types</option>
                <option value="income">Income only</option>
                <option value="expense">Expense only</option>
              </select>
            </div>
            <div className="form-group">
              <label>Category</label>
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
                style={{ fontSize: 13, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text)', width: '100%' }}>
                {ALL_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>From date</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="form-group">
              <label>To date</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
          </div>
          {dateFrom && dateTo && dateFrom > dateTo && (
            <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 8 }}>From date must be before To date</div>
          )}
        </div>
      )}

      {/* Summary */}
      <div className="summary-pills" style={{ marginBottom: 14 }}>
        <span className="pill" style={{ background: 'var(--green-bg)', color: 'var(--green)' }}>Income: {fmt(income)}</span>
        <span className="pill" style={{ background: 'var(--red-bg)', color: 'var(--red)' }}>Expenses: {fmt(expense)}</span>
        <span className="pill" style={{ background: income - expense >= 0 ? 'var(--green-bg)' : 'var(--red-bg)', color: income - expense >= 0 ? 'var(--green)' : 'var(--red)' }}>
          Net: {fmt(income - expense)}
        </span>
        <span className="pill" style={{ background: 'var(--blue-bg)', color: 'var(--blue)' }}>
          {filtered.length}{filtered.length !== transactions.length ? ` of ${transactions.length}` : ''} entries
        </span>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? <div className="loading">Loading...</div> : filtered.length === 0 ? (
          <div className="empty">
            {hasActiveFilters ? 'No entries match your search.' : `No entries for ${month}.`}
            <br />
            <span style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
              {hasActiveFilters ? <button className="btn" style={{ marginTop: 8, fontSize: 12 }} onClick={clearFilters}>Clear filters</button> : 'Click "+ Add entry" to record income or expenses.'}
            </span>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Date</th><th>Type</th><th>Category</th><th>Description</th><th style={{ textAlign: 'right' }}>Amount</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id}>
                    <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{t.date}</td>
                    <td><span className={`badge ${t.type === 'income' ? 'badge-green' : 'badge-red'}`}>{t.type}</span></td>
                    <td><span className="badge badge-blue">{t.category}</span></td>
                    <td style={{ color: search && (t.description || '').toLowerCase().includes(search.toLowerCase()) ? 'var(--text)' : 'var(--text-secondary)' }}>
                      {t.description || '—'}
                    </td>
                    <td style={{ textAlign: 'right' }} className={t.type === 'income' ? 'amt-income' : 'amt-expense'}>
                      {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
                    </td>
                    <td>
                      {!isStaff && (
                        <button onClick={() => handleDelete(t.id)} title="Delete"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 18, padding: '0 4px', lineHeight: 1 }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}>×</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add entry modal */}
      {showAdd && (
        <Modal title="Add entry" onClose={() => setShowAdd(false)}
          footer={<><button className="btn" onClick={() => setShowAdd(false)}>Cancel</button><button className="btn btn-primary" onClick={handleAdd}>Save</button></>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-grid">
              <div className="form-group"><label>Date</label><input type="date" value={form.date} onChange={f('date')} /></div>
              <div className="form-group"><label>Type</label>
                <select value={form.type} onChange={e => handleTypeChange(e.target.value)}>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group"><label>Category</label>
                <select value={form.category} onChange={f('category')}>
                  {(form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="form-group"><label>Amount (₹)</label><input type="number" placeholder="0" value={form.amount} onChange={f('amount')} /></div>
            </div>
            <div className="form-grid single">
              <div className="form-group">
                <label>Description (optional)</label>
                <input
                  placeholder={form.category === 'Daily rent' ? 'e.g. John - 11 Apr stay' : form.category === 'Food' ? 'e.g. John - lunch + dinner' : 'Short note'}
                  value={form.description} onChange={f('description')} />
              </div>
            </div>
          </div>
        </Modal>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
