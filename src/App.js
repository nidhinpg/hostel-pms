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
import ResetPassword from './pages/ResetPassword'
import './App.css'

function SettingsModal({ onClose, activeProperty, onSaved }) {
  const [gpay, setGpay] = useState(activeProperty?.gpay_number || '')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const save = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('properties')
      .update({ gpay_number: gpay.trim() })
      .eq('id', activeProperty.id)
    setSaving(false)
    if (error) { setToast('Error saving'); return }
    setToast('Saved!')
    onSaved(gpay.trim())
    setTimeout(onClose, 800)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200, padding: 20
    }} onClick={onClose}>
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius)',
        padding: 24, minWidth: 300, maxWidth: 400, width: '100%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Property Settings</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>{activeProperty?.name}</div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>
            GPay Number (for WhatsApp reminders)
          </label>
          <input
            value={gpay}
            onChange={e => setGpay(e.target.value)}
            placeholder="e.g. 9947674921"
            style={{
              width: '100%', padding: '8px 10px', fontSize: 13,
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {toast && <div style={{ fontSize: 12, color: 'var(--green)', marginBottom: 12 }}>{toast}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AppContent() {
  const { user, profile, properties, activeProperty, selectProperty, signOut, loading, isAdmin, isStaff, isOwner, permissions, refreshProperties } = useAuth()
  const [page, setPage] = useState('dashboard')
  const [tenantFilter, setTenantFilter] = useState('all')
  const [showPropertyMenu, setShowPropertyMenu] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Loading...</div>
    </div>
  )

  if (!user) return <Login />

  if (!activeProperty && !isAdmin) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 }}>
      <div className="card" style={{ maxWidth: 400, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🏢</div>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>No property assigned</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          Contact your administrator to assign a property to your account.
        </div>
        <button className="btn" onClick={signOut}>Sign out</button>
      </div>
    </div>
  )

  // Trial/subscription check — skip for admin
  if (!isAdmin && activeProperty) {
    const status = activeProperty.subscription_status
    const planType = activeProperty.plan_type
    const trialEnd = activeProperty.trial_end_date ? new Date(activeProperty.trial_end_date) : null
    const isTrialExpired = planType === 'trial' && trialEnd && trialEnd < new Date()
    const isSuspended = status === 'suspended' || status === 'expired'

    if (isTrialExpired || isSuspended) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 }}>
          <div className="card" style={{ maxWidth: 420, textAlign: 'center', padding: 32 }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⏰</div>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>
              {isTrialExpired ? 'Your free trial has ended' : 'Subscription expired'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
              {activeProperty.name}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
              {isTrialExpired
                ? 'Your 3-month free trial has expired. Upgrade to Pro to continue using Pavio.'
                : 'Your subscription is no longer active. Please contact admin to reactivate.'}
            </div>
            <a
              href={`https://wa.me/917012160141?text=Hi%20Nidhin%2C%20I%20want%20to%20upgrade%20my%20Pavio%20plan%20for%20${encodeURIComponent(activeProperty.name)}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-block', background: '#25D366', color: 'white',
                padding: '10px 20px', borderRadius: 'var(--radius)', fontSize: 14,
                fontWeight: 600, textDecoration: 'none', marginBottom: 12
              }}>
              💬 Contact on WhatsApp
            </a>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16 }}>
              or call: 9061780979
            </div>
            <button className="btn" style={{ fontSize: 12 }} onClick={signOut}>Sign out</button>
          </div>
        </div>
      )
    }
  }

  const userRole = isAdmin ? 'admin' : isStaff ? 'staff' : 'owner'

  // Staff removed from nav — moved to profile dropdown
  const ALL_PAGES = [
    { id: 'dashboard', label: 'Dashboard',           roles: ['owner', 'staff', 'admin'], permKey: 'view_dashboard' },
    { id: 'beds',      label: 'Bed map',             roles: ['owner', 'staff', 'admin'], permKey: 'view_bedmap' },
    { id: 'tenants',   label: 'Tenants',             roles: ['owner', 'staff', 'admin'], permKey: null },
    { id: 'finance',   label: 'Receipts & payments', roles: ['owner', 'staff', 'admin'], permKey: 'add_expenses' },
    { id: 'reports',   label: 'Reports',             roles: ['owner', 'admin'],          permKey: 'view_reports' },
  ]

  const navPages = ALL_PAGES.filter(p => {
    if (!p.roles.includes(userRole)) return false
    if (isStaff && p.permKey && !permissions[p.permKey]) return false
    return true
  })

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: '#D85A30', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="17" height="17" viewBox="0 0 48 48" fill="none">
                  <circle cx="20" cy="24" r="10" stroke="white" strokeWidth="2.5" fill="none"/>
                  <line x1="28" y1="16" x2="40" y2="38" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                  <circle cx="20" cy="24" r="4" fill="white"/>
                </svg>
              </div>
              <span className="logo-text" style={{ fontWeight: 600, letterSpacing: '-0.3px' }}>Pavio</span>
            </div>

            {/* Property switcher */}
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
                {/* Profile info */}
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{profile?.full_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{user?.email}</div>
                  <div style={{ marginTop: 6 }}>
                    {isAdmin && <span className="badge badge-blue">Admin</span>}
                    {isStaff && <span className="badge badge-green">Staff</span>}
                    {isOwner && !isAdmin && <span className="badge badge-amber">Owner</span>}
                  </div>
                </div>

                {/* Admin panel — admins only */}
                {isAdmin && (
                  <div
                    onClick={() => { setPage('admin'); setShowUserMenu(false) }}
                    style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    🛡️ Admin panel
                  </div>
                )}

                {/* Staff management — owners only */}
                {isOwner && (
                  <div
                    onClick={() => { setPage('staff'); setShowUserMenu(false) }}
                    style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    👥 Staff management
                  </div>
                )}

                {/* Settings — owners only */}
                {isOwner && activeProperty && (
                  <div
                    onClick={() => { setShowSettings(true); setShowUserMenu(false) }}
                    style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    ⚙️ Settings
                  </div>
                )}

                {/* Sign out */}
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
                {page === 'dashboard' && permissions.view_dashboard &&
                  <Dashboard
                    onNavigate={(p, filter) => { setPage(p); if (filter) setTenantFilter(filter); else setTenantFilter('all') }}
                    propertyId={activeProperty.id}
                  />}

                {page === 'beds' && permissions.view_bedmap &&
                  <BedMap
                    propertyId={activeProperty.id}
                    isStaff={isStaff}
                    canAddBeds={permissions.add_beds}
                  />}

                {page === 'tenants' &&
                  <Tenants
                    key={tenantFilter}
                    propertyId={activeProperty.id}
                    isStaff={isStaff}
                    initialFilter={tenantFilter}
                    canAddTenants={permissions.add_tenants}
                    canDeleteEntries={permissions.delete_entries}
                    canCollectRent={permissions.collect_rent}
                  />}

                {page === 'finance' && permissions.add_expenses &&
                  <Finance
                    propertyId={activeProperty.id}
                    isStaff={isStaff}
                    canDelete={permissions.delete_entries}
                  />}

                {page === 'reports' && permissions.view_reports && !isStaff &&
                  <Reports propertyId={activeProperty.id} />}

                {['dashboard','beds','finance','reports'].includes(page) &&
                  isStaff && !permissions[
                    page === 'dashboard' ? 'view_dashboard' :
                    page === 'beds' ? 'view_bedmap' :
                    page === 'finance' ? 'add_expenses' :
                    'view_reports'
                  ] && (
                  <div style={{ marginTop: 60, textAlign: 'center' }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>Access restricted</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      Your owner has disabled access to this section.
                    </div>
                  </div>
                )}
              </>
        )}
      </main>

      {/* Settings modal */}
      {showSettings && activeProperty && (
        <SettingsModal
          activeProperty={activeProperty}
          onClose={() => setShowSettings(false)}
          onSaved={(newGpay) => {
            // Update activeProperty gpay in memory so reminders use new number immediately
            activeProperty.gpay_number = newGpay
          }}
        />
      )}
    </div>
  )
}

export default function App() {
  if (window.location.pathname === '/reset-password') {
    return <ResetPassword />
  }
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
