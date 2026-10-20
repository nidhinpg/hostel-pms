import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

// Pavio logo, or the owner's own uploaded logo when a url is given
export function BrandMark({ url, size = 24 }) {
  if (url) {
    return <img src={url} alt="Logo" style={{ width: size, height: size, borderRadius: Math.round(size / 4), objectFit: 'cover', display: 'block' }} />
  }
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
  planLabel, profile, user, isOwner, onSignOut, onLogoChanged,
}) {
  const [showHostels, setShowHostels] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef(null)
  if (!open) return null

  const logoUrl = profile?.logo_url || null
  const displayName = profile?.full_name || user?.email || ''

  async function saveLogoUrl(url) {
    const { error } = await supabase.from('profiles').update({ logo_url: url }).eq('id', user.id)
    if (error) throw error
    if (onLogoChanged) onLogoChanged()
  }

  async function handleFile(e) {
    const file = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setErr('Use a PNG, JPG or WebP image'); return }
    if (file.size > 1024 * 1024) { setErr('Image must be under 1 MB'); return }
    setBusy(true); setErr('')
    try {
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
      const path = user.id + '/logo-' + Date.now() + '.' + ext
      const { error: upErr } = await supabase.storage.from('owner-logos').upload(path, file, { contentType: file.type, upsert: true })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('owner-logos').getPublicUrl(path)
      await saveLogoUrl(data.publicUrl)
    } catch (ex) {
      setErr('Could not upload the logo. Try again.')
    }
    setBusy(false)
  }

  async function removeLogo() {
    setBusy(true); setErr('')
    try { await saveLogoUrl(null) } catch (ex) { setErr('Could not remove the logo. Try again.') }
    setBusy(false)
  }

  const smallBtn = { background: 'none', border: 'none', padding: '8px 0', fontSize: 13, color: 'var(--text-secondary)', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }

  return (
    <div className="m-drawer-overlay" onClick={onClose}>
      <aside className="m-drawer" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <BrandMark url={logoUrl} size={44} />
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
          {isOwner && (
            <>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={handleFile} />
              <button style={smallBtn} disabled={busy} onClick={() => fileRef.current && fileRef.current.click()}>
                {busy ? 'Working...' : (logoUrl ? 'Change my logo' : 'Upload my logo')}
              </button>
              {logoUrl && <button style={smallBtn} disabled={busy} onClick={removeLogo}>Use Pavio logo</button>}
              {err && <div style={{ fontSize: 12, color: 'var(--red)', padding: '2px 0 6px' }}>{err}</div>}
            </>
          )}
          <button style={{ ...smallBtn, color: 'var(--red)' }} onClick={onSignOut}>Sign out</button>
        </div>
      </aside>
    </div>
  )
}
