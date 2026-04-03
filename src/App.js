import { useState } from 'react'
import Dashboard from './pages/Dashboard'
import BedMap from './pages/BedMap'
import Tenants from './pages/Tenants'
import Finance from './pages/Finance'
import Reports from './pages/Reports'
import './App.css'

const PAGES = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'beds', label: 'Bed map' },
  { id: 'tenants', label: 'Tenants' },
  { id: 'finance', label: 'Income & expenses' },
  { id: 'reports', label: 'Reports' },
]

export default function App() {
  const [page, setPage] = useState('dashboard')

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">🏠</span>
            <span className="logo-text">ABDF Hostel PMS</span>
          </div>
          <nav className="nav">
            {PAGES.map(p => (
              <button
                key={p.id}
                className={`nav-btn ${page === p.id ? 'active' : ''}`}
                onClick={() => setPage(p.id)}
              >
                {p.label}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="main">
        {page === 'dashboard' && <Dashboard onNavigate={setPage} />}
        {page === 'beds' && <BedMap />}
        {page === 'tenants' && <Tenants />}
        {page === 'finance' && <Finance />}
        {page === 'reports' && <Reports />}
      </main>
    </div>
  )
}
