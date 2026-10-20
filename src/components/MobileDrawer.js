import { useState } from 'react'

export function BrandMark({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 192 192" aria-label="Pavio" style={{ display: 'block', borderRadius: Math.round(size / 4) }}>
      <rect width="192" height="192" fill="#DB5B30" />
      <circle cx="75" cy="97" r="36" fill="none" stroke="#fff" strokeWidth="12" />
      <circle cx="75" cy="97" r="14" fill="#fff" />
      <line x1="112" y1="60" x2="156" y2="148" stroke="#fff" strokeWidth="12" strokeLinecap="round" />
    </svg>
  )
}

const ICONS = {
  dashboard: '📊', bedmap: '🛏', beds: '🛏', bed_map: '🛏',
  tenants: '👥', finance: '💰', receipts: '💰', reports: '📈',
  staff: '🧑', admin: '⚙️',
}

export default function MobileDrawer({
  open, onClose, navPages, page, onNavigate,
  properties, activeProperty, canSwitch, onSelectProperty,
  planLabel, profile, user, onSignOut,
}) {
  const [showHostels, setShowHostels] = useState(false)
  if (!open) return null

  const displayName = profile?.full_name || user?.email || ''
  const signOutBtn = { background: 'none', border: 'none', padding: '8px 0', fontSize: 13, color: 'var(--red)', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }

  return (
    <div className="m-drawer-overlay" onClick={onClose}>
      <aside className="m-drawer" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <BrandMark size={44} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
            {planLabel && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{planLabel}</div>}
          </div>
        </div>

        {activeProperty && (
          <div style={{ marginBottom: 10 }}>
            <button
              onClick={() => canSwitch && setShowHostels(!showHostels)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg)', fontSize: 14, fontWeight: 500, color: 'var(--text)', fontFamily: 'inherit', cursor: canSwitch ? 'pointer' : 'default' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeProperty.name}</span>
              {canSwitch && <span style={{ fontSize: 10, opacity: 0.6 }}>{showHostels ? '▲' : '▼'}</span>}
            </button>
            {canSwitch && showHostels && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', marginTop: 4, overflow: 'hidden' }}>
                {properties.map(p => (
                  <div key={p.id} onClick={() => { setShowHostels(false); onSelectProperty(p) }}
                    style={{ padding: '10px 12px', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid var(--border)', background: activeProperty.id === p.id ? 'var(--bg)' : 'transparent', fontWeight: activeProperty.id === p.id ? 600 : 400 }}>
                    <div>{p.name}</div>
                    {p.city && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{p.city}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
          {navPages.map(p => (
            <button key={p.id} onClick={() => onNavigate(p.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 15, fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer', background: page === p.id ? 'var(--bg)' : 'transparent', color: 'var(--text)', fontWeight: page === p.id ? 600 : 400 }}>
              <span style={{ width: 22, textAlign: 'center' }}>{ICONS[p.id] || '•'}</span>
              {p.label}
            </button>
          ))}
        </nav>

        <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', flexDirection: 'column' }}>
          <button style={signOutBtn} onClick={onSignOut}>Sign out</button>
        </div>
      </aside>
    </div>
  )
}
