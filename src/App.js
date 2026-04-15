import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import BedMap from './pages/BedMap'
import Tenants from './pages/Tenants'
import Finance from './pages/Finance'
import Reports from './pages/Reports'
import AdminPanel from './pages/AdminPanel'
import StaffManager from './pages/StaffManager'
import './App.css'

function AppContent() {
  const { user, profile, properties, activeProperty, selectProperty, signOut, loading, isAdmin, isStaff, isOwner } = useAuth()
  const [page, setPage] = useState('dashboard')
  const [tenantFilter, setTenantFilter] = useState('all')
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

  const userRole = isAdmin ? 'admin' : isStaff ? 'staff' : 'owner'

  const ALL_PAGES = [
    { id: 'dashboard', label: 'Dashboard', roles: ['owner', 'staff', 'admin'] },
    { id: 'beds', label: 'Bed map', roles: ['owner', 'staff', 'admin'] },
    { id: 'tenants', label: 'Tenants', roles: ['owner', 'staff', 'admin'] },
    { id: 'finance', label: 'Income & expenses', roles: ['owner', 'staff', 'admin'] },
    { id: 'reports', label: 'Reports', roles: ['owner', 'admin'] },
    { id: 'staff', label: 'Staff', roles: ['owner', 'admin'] },
    { id: 'admin', label: 'Admin', roles: ['admin'] },
  ]

  const navPages = ALL_PAGES.filter(p => p.roles.includes(userRole))

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="logo">
              <span className="logo-icon">🏠</span>
              <span className="logo-text">Hosteloops PMS</span>
            </div>

            {/* Property switcher — owners with multiple properties */}
            {isOwner && properties.length > 1 && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => { setShowPropertyMenu(!showPropertyMenu); setShowUserMenu(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px',
                    fontSize: 13, fontWeight: 500, background: 'var(--bg)',
                    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer', color: 'var(--text)', fontFamily: 'inherit'
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

            {/* Staff sees property name as badge */}
            {isStaff && activeProperty && (
              <div style={{
                padding: '4px 10px', background: 'var(--blue-bg)', color: 'var(--blue)',
                borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 500
              }}>
                {activeProperty.name}
              </div>
            )}
          </div>

          <nav className="nav">
            {navPages.map(p => (
              <button key={p.id}
                className={`nav-btn ${page === p.id ? 'active' : ''}`}
                onClick={() => { setPage(p.id); setTenantFilter('all'); setShowPropertyMenu(false); setShowUserMenu(false) }}>
                {p.label}
              </button>
            ))}
          </nav>

          {/* User avatar menu */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => { setShowUserMenu(!showUserMenu); setShowPropertyMenu(false) }}
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: isStaff ? 'var(--blue)' : 'var(--text)',
                color: 'white', border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600,
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
                  <div style={{ marginTop: 6 }}>
                    {isAdmin && <span className="badge badge-blue">Admin</span>}
                    {isStaff && <span className="badge badge-green">Staff</span>}
                    {isOwner && !isAdmin && <span className="badge badge-amber">Owner</span>}
                  </div>
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
        {page === 'admin' && isAdmin && <AdminPanel />}
        {page === 'staff' && isOwner && <StaffManager propertyId={activeProperty?.id} />}
        {!['admin', 'staff'].includes(page) && (
          !activeProperty
            ? <div className="empty" style={{ marginTop: 60 }}>Select a property to continue</div>
            : <>
                {page === 'dashboard' && <Dashboard onNavigate={(p, filter) => { setPage(p); if (filter) setTenantFilter(filter); else setTenantFilter('all') }} propertyId={activeProperty.id} />}
                {page === 'beds' && <BedMap propertyId={activeProperty.id} isStaff={isStaff} />}
                {page === 'tenants' && <Tenants key={tenantFilter} propertyId={activeProperty.id} isStaff={isStaff} initialFilter={tenantFilter} />}
                {page === 'finance' && <Finance propertyId={activeProperty.id} isStaff={isStaff} />}
                {page === 'reports' && !isStaff && <Reports propertyId={activeProperty.id} />}
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
