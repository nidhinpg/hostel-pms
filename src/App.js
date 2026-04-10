import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import BedMap from './pages/BedMap'
import Tenants from './pages/Tenants'
import Finance from './pages/Finance'
import Reports from './pages/Reports'
import AdminPanel from './pages/AdminPanel'
import './App.css'

const PAGES = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'beds', label: 'Bed map' },
  { id: 'tenants', label: 'Tenants' },
  { id: 'finance', label: 'Income & expenses' },
  { id: 'reports', label: 'Reports' },
]

function AppContent() {
  const { user, profile, properties, activeProperty, selectProperty, signOut, loading, isAdmin } = useAuth()
  const [page, setPage] = useState('dashboard')
  const [showPropertyMenu, setShowPropertyMenu] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Loading...</div>
    </div>
  )

  if (!user) return <Login />

  if (!activeProperty && !isAdmin) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 }}>
      <div className="card" style={{ maxWidth: 400, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🏠</div>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>No property assigned</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          Contact your administrator to assign a property to your account.
        </div>
        <button className="btn" onClick={signOut}>Sign out</button>
      </div>
    </div>
  )

  const navPages = isAdmin
    ? [...PAGES, { id: 'admin', label: 'Admin' }]
    : PAGES

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="logo">
              <span className="logo-icon">🏠</span>
              <span className="logo-text">Hostel PMS</span>
            </div>

            {/* Property switcher */}
            {properties.length > 0 && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => { setShowPropertyMenu(!showPropertyMenu); setShowUserMenu(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 10px', fontSize: 13, fontWeight: 500,
                    background: 'var(--bg)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                    color: 'var(--text)', fontFamily: 'inherit'
                  }}>
                  {activeProperty?.name || 'Select property'}
                  <span style={{ fontSize: 10, opacity: 0.6 }}>▼</span>
                </button>
                {showPropertyMenu && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, marginTop: 4,
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    minWidth: 200, zIndex: 100, overflow: 'hidden'
                  }}>
                    {properties.map(p => (
                      <div key={p.id}
                        onClick={() => { selectProperty(p); setShowPropertyMenu(false); setPage('dashboard') }}
                        style={{
                          padding: '10px 14px', cursor: 'pointer', fontSize: 13,
                          background: activeProperty?.id === p.id ? 'var(--bg)' : 'transparent',
                          fontWeight: activeProperty?.id === p.id ? 600 : 400,
                          borderBottom: '1px solid var(--border)'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                        onMouseLeave={e => e.currentTarget.style.background = activeProperty?.id === p.id ? 'var(--bg)' : 'transparent'}>
                        <div>{p.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{p.city}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <nav className="nav">
            {navPages.map(p => (
              <button
                key={p.id}
                className={`nav-btn ${page === p.id ? 'active' : ''}`}
                onClick={() => { setPage(p.id); setShowPropertyMenu(false); setShowUserMenu(false) }}>
                {p.label}
              </button>
            ))}
          </nav>

          {/* User menu */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => { setShowUserMenu(!showUserMenu); setShowPropertyMenu(false) }}
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'var(--text)', color: 'white',
                border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
              {(profile?.full_name || user?.email || 'U')[0].toUpperCase()}
            </button>
            {showUserMenu && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 8,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                minWidth: 200, zIndex: 100, overflow: 'hidden'
              }}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{profile?.full_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{user?.email}</div>
                  {isAdmin && <span className="badge badge-blue" style={{ marginTop: 4 }}>Admin</span>}
                </div>
                <div
                  onClick={() => { signOut(); setShowUserMenu(false) }}
                  style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--red)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  Sign out
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="main" onClick={() => { setShowPropertyMenu(false); setShowUserMenu(false) }}>
        {page === 'admin' && isAdmin ? (
          <AdminPanel />
        ) : !activeProperty ? (
          <div className="empty" style={{ marginTop: 60 }}>Select a property to continue</div>
        ) : (
          <>
            {page === 'dashboard' && <Dashboard onNavigate={setPage} propertyId={activeProperty.id} />}
            {page === 'beds' && <BedMap propertyId={activeProperty.id} />}
            {page === 'tenants' && <Tenants propertyId={activeProperty.id} />}
            {page === 'finance' && <Finance propertyId={activeProperty.id} />}
            {page === 'reports' && <Reports propertyId={activeProperty.id} />}
          </>
        )}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
