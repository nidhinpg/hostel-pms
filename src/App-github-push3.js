import { useState, useEffect } from 'react'
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
import { Capacitor } from '@capacitor/core'
import Landing from './pages/Landing'
import Signup from './pages/Signup'

// ─── Razorpay ────────────────────────────────────────────────────────────────
const RAZORPAY_KEY = 'rzp_live_T7TrGIeNx4lC0M'

// Properties permanently exempt from the trial/subscription paywall — no billing ever,
// for owner or staff. Currently just Hosteloops (internal/testing account).
const BILLING_EXEMPT_PROPERTY_IDS = new Set([
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890', // Hosteloops
])

const PLANS = {
  basic_monthly:  { id: 'plan_T8CxyqT1NVMQOl', label: '📦 Basic Monthly',  price: '₹499/month',  desc: 'Manual WhatsApp reminders' },
  basic_yearly:   { id: 'plan_T8D05XTWtcpnYT', label: '📦 Basic Yearly',   price: '₹3,999/year', desc: 'Manual WhatsApp reminders', save: 'SAVE ₹1,989' },
  pro_monthly:    { id: 'plan_T7U81QEbhRW5zP', label: '⚡ Pro Monthly',    price: '₹999/month',  desc: 'Auto WhatsApp from Pavio number' },
  pro_yearly:     { id: 'plan_T7WMuKFrSxeIcI', label: '🏆 Pro Yearly',     price: '₹7,999/year', desc: 'Auto WhatsApp from Pavio number', save: 'SAVE ₹3,989' },
}

// Short, plain-language feature lists shown under each tier so the difference is obvious at a glance.
const TIER_FEATURES = {
  basic: [
    '1 property',
    'Tap a button to open WhatsApp, you hit send',
    'Finance reports — CSV & PDF export',
  ],
  pro: [
    'Unlimited properties',
    'Staff logins with permission controls',
    'WhatsApp reminders sent automatically, every day',
    'Push notifications for rent due',
    'Priority WhatsApp support',
  ],
}

const loadRazorpay = () => new Promise(resolve => {
  if (window.Razorpay) return resolve(true)
  const script = document.createElement('script')
  script.src = 'https://checkout.razorpay.com/v1/checkout.js'
  script.onload = () => resolve(true)
  script.onerror = () => resolve(false)
  document.body.appendChild(script)
})

const openRazorpay = async (property, planKey) => {
  const loaded = await loadRazorpay()
  if (!loaded) { alert('Failed to load payment. Please try again.'); return }

  const plan = PLANS[planKey]
  const res = await fetch('https://elmqjkyyjxtbnnfbpndb.supabase.co/functions/v1/create-subscription', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsbXFqa3l5anh0Ym5uZmJwbmRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUyNDI0MDQsImV4cCI6MjA2MDgxODQwNH0.eVSHJCGCOi5j1zT40KGqHsRXbXDCwx8NJNC09zkahQE'
    },
    body: JSON.stringify({ property_id: property.id, property_name: property.name, plan_id: plan.id })
  })
  const { subscription_id, error } = await res.json()
  if (error || !subscription_id) { alert('Error: ' + (error || 'No subscription created — please try again or contact support@pavio.tech')); return }

  new window.Razorpay({
    key: RAZORPAY_KEY,
    subscription_id,
    name: 'Pavio PMS',
    description: plan.label + ' - ' + property.name,
    handler: async (response) => {
      try {
        const res = await fetch('https://elmqjkyyjxtbnnfbpndb.supabase.co/functions/v1/activate-subscription', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsbXFqa3l5anh0Ym5uZmJwbmRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUyNDI0MDQsImV4cCI6MjA2MDgxODQwNH0.eVSHJCGCOi5j1zT40KGqHsRXbXDCwx8NJNC09zkahQE'
          },
          body: JSON.stringify({
            property_id: property.id,
            plan_type: planKey.startsWith('pro') ? 'pro' : 'basic',
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_subscription_id: response.razorpay_subscription_id,
            razorpay_signature: response.razorpay_signature
          })
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || data.error) {
          alert(
            'Payment was received, but activating your plan failed (' + (data.error || res.status) + ').\n\n' +
            'Please contact support@pavio.tech with this payment ID so we can fix it manually:\n' +
            response.razorpay_payment_id
          )
          return
        }
        alert('Payment successful! Your plan is now active.')
        window.location.reload()
      } catch (err) {
        alert(
          'Payment was received, but we could not confirm activation.\n\n' +
          'Please contact support@pavio.tech with this payment ID:\n' +
          response.razorpay_payment_id
        )
      }
    },
    theme: { color: '#D85A30' }
  }).open()
}

// ─── Feature list (shared between Upgrade modal and expired screen) ──────────
function FeatureList({ items }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px', textAlign: 'left' }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: 'flex', gap: 6, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, lineHeight: 1.4 }}>
          <span style={{ flexShrink: 0 }}>✓</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

// ─── Settings Modal ───────────────────────────────────────────────────────────
function SettingsModal({ onClose, activeProperty, onOpenStaffManagement, onOpenManageProperties }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }} onClick={onClose}>
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 24, minWidth: 300, maxWidth: 400, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Property Settings</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: onOpenStaffManagement ? 20 : 0 }}>{activeProperty?.name}</div>

        {onOpenStaffManagement && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button className="btn" style={{ textAlign: 'left' }} onClick={onOpenStaffManagement}>
              👥 Staff management
            </button>
            {onOpenManageProperties && (
              <button className="btn" style={{ textAlign: 'left' }} onClick={onOpenManageProperties}>
                🏘️ Manage properties
              </button>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

// ─── Add Property Modal (Pro only) ────────────────────────────────────────────
function AddPropertyModal({ onClose, userId, onCreated }) {
  const [form, setForm] = useState({ property_name: '', city: '', gpay_number: '', address: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const submit = async () => {
    setError('')
    if (!form.property_name.trim()) { setError('Property name is required'); return }

    setSaving(true)
    try {
      const res = await fetch('https://elmqjkyyjxtbnnfbpndb.supabase.co/functions/v1/add-property', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsbXFqa3l5anh0Ym5uZmJwbmRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUyNDI0MDQsImV4cCI6MjA2MDgxODQwNH0.eVSHJCGCOi5j1zT40KGqHsRXbXDCwx8NJNC09zkahQE'
        },
        body: JSON.stringify({
          requester_id: userId,
          property_name: form.property_name.trim(),
          city: form.city.trim(),
          gpay_number: form.gpay_number.trim(),
          address: form.address.trim(),
        })
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Could not create property. Please try again.')
        setSaving(false)
        return
      }
      onCreated(data.property)
      onClose()
    } catch (err) {
      setError(err?.message || 'Unexpected error. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }} onClick={onClose}>
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 24, minWidth: 320, maxWidth: 420, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Add another property</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>Included with your Pro plan — no separate payment.</div>

        {error && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 12, padding: '8px 10px', background: 'var(--red-bg)', borderRadius: 'var(--radius-sm)' }}>{error}</div>}

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Property name *</label>
          <input value={form.property_name} onChange={f('property_name')} placeholder="e.g. Blue Nest Stays"
            style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>City</label>
          <input value={form.city} onChange={f('city')} placeholder="e.g. Kochi"
            style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>GPay number</label>
          <input value={form.gpay_number} onChange={f('gpay_number')} placeholder="10 digits"
            style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Address</label>
          <textarea value={form.address} onChange={f('address')} rows={2} placeholder="Property address (optional)"
            style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }} />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Creating...' : 'Create property'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Manage Properties Modal ──────────────────────────────────────────────────
// Lists every property the owner has, lets them edit each property's GPay
// number inline, and delete a property. Delete is blocked server-side if the
// property still has tenants/beds, or if it's the owner's only remaining one.
function ManagePropertiesModal({ onClose, userId, properties, activeProperty, onDeleted, onUpdated, onOpenAddProperty, showAddProperty }) {
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [savingId, setSavingId] = useState(null)

  const handleDelete = async (property) => {
    setError('')
    if (!window.confirm(`Delete ${property.name}? This cannot be undone.`)) return

    setDeletingId(property.id)
    try {
      const res = await fetch('https://elmqjkyyjxtbnnfbpndb.supabase.co/functions/v1/delete-property', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsbXFqa3l5anh0Ym5uZmJwbmRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUyNDI0MDQsImV4cCI6MjA2MDgxODQwNH0.eVSHJCGCOi5j1zT40KGqHsRXbXDCwx8NJNC09zkahQE'
        },
        body: JSON.stringify({ requester_id: userId, property_id: property.id })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        setError(data.error || 'Could not delete property. Please try again.')
        setDeletingId(null)
        return
      }
      setDeletingId(null)
      onDeleted(property.id)
    } catch (err) {
      setError(err?.message || 'Unexpected error. Please try again.')
      setDeletingId(null)
    }
  }

  const startEdit = (property) => {
    setError('')
    setEditingId(property.id)
    setEditValue(property.gpay_number || '')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditValue('')
  }

  const saveEdit = async (property) => {
    setError('')
    setSavingId(property.id)
    const { error: updateErr } = await supabase
      .from('properties')
      .update({ gpay_number: editValue.trim() })
      .eq('id', property.id)
    setSavingId(null)
    if (updateErr) {
      setError(updateErr.message || 'Could not save GPay number. Please try again.')
      return
    }
    setEditingId(null)
    onUpdated && onUpdated(property.id, editValue.trim())
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }} onClick={onClose}>
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 24, minWidth: 340, maxWidth: 440, width: '100%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Manage properties</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
          {properties.length} {properties.length === 1 ? 'property' : 'properties'}
        </div>

        {error && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 12, padding: '8px 10px', background: 'var(--red-bg)', borderRadius: 'var(--radius-sm)' }}>{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {properties.map(p => (
            <div key={p.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', background: activeProperty?.id === p.id ? 'var(--bg)' : 'transparent' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                <button
                  onClick={() => handleDelete(p)}
                  disabled={deletingId === p.id || properties.length <= 1 || editingId === p.id}
                  title={properties.length <= 1 ? 'You must keep at least one property' : 'Delete property'}
                  style={{ fontSize: 11, color: (properties.length <= 1 || editingId === p.id) ? 'var(--text-tertiary)' : 'var(--red)', background: 'none', border: 'none', cursor: (properties.length <= 1 || editingId === p.id) ? 'not-allowed' : 'pointer', padding: '4px 8px', textDecoration: 'underline', flexShrink: 0 }}>
                  {deletingId === p.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>

              {p.city && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{p.city}</div>}

              {editingId === p.id ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8 }}>
                  <input
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    placeholder="e.g. 9947674921"
                    autoFocus
                    style={{ flex: 1, padding: '6px 8px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  <button className="btn btn-primary" style={{ fontSize: 11, padding: '5px 10px' }} onClick={() => saveEdit(p)} disabled={savingId === p.id}>
                    {savingId === p.id ? 'Saving...' : 'Save'}
                  </button>
                  <button className="btn" style={{ fontSize: 11, padding: '5px 10px' }} onClick={cancelEdit} disabled={savingId === p.id}>Cancel</button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>GPay: {p.gpay_number || '—'}</div>
                  <button
                    onClick={() => startEdit(p)}
                    style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', textDecoration: 'underline', flexShrink: 0 }}>
                    Edit
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {showAddProperty && (
          <button className="btn" style={{ textAlign: 'left', width: '100%', marginBottom: 16, boxSizing: 'border-box' }} onClick={onOpenAddProperty}>
            ➕ Add property
          </button>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

// ─── Upgrade Modal ────────────────────────────────────────────────────────────
function UpgradeModal({ onClose, activeProperty }) {
  // Calculate trial days remaining (if on trial)
  const trialEnd = activeProperty?.trial_end_date ? new Date(activeProperty.trial_end_date) : null
  const daysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd - new Date()) / (1000 * 60 * 60 * 24))) : null
  const isTrial = activeProperty?.plan_type === 'trial'

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }} onClick={onClose}>
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 28, minWidth: 320, maxWidth: 440, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', position: 'relative' }} onClick={e => e.stopPropagation()}>

        {/* Dismiss X button */}
        <button onClick={onClose}
          style={{ position: 'absolute', top: 12, right: 12, width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          aria-label="Close">
          ×
        </button>

        {/* Trial-days-remaining banner — shown only for trial users */}
        {isTrial && daysLeft !== null && (
          <div style={{
            background: daysLeft <= 5 ? 'var(--red-bg)' : 'var(--amber-bg)',
            color: daysLeft <= 5 ? 'var(--red)' : 'var(--amber)',
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 13,
            fontWeight: 600,
            textAlign: 'center',
            marginBottom: 18,
            marginTop: 4
          }}>
            {daysLeft === 0 ? '⏰ Your trial ends today' : daysLeft === 1 ? '⏰ 1 day left in your trial' : `⏰ ${daysLeft} days left in your trial`}
          </div>
        )}

        <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4, textAlign: 'center' }}>Choose a Plan</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20, textAlign: 'center' }}>{activeProperty?.name}</div>

        {/* Basic */}
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8, letterSpacing: '0.5px' }}>Basic — Manual WhatsApp</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {['basic_monthly', 'basic_yearly'].map(key => {
            const p = PLANS[key]
            return (
              <button key={key} onClick={() => { openRazorpay(activeProperty, key); onClose() }}
                style={{ flex: 1, padding: '10px 8px', borderRadius: 'var(--radius)', border: '2px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', position: 'relative', textAlign: 'center' }}>
                {p.save && <span style={{ position: 'absolute', top: -8, right: 4, background: '#25D366', color: 'white', fontSize: 9, padding: '2px 5px', borderRadius: 8, fontWeight: 700 }}>{p.save}</span>}
                <div style={{ fontWeight: 700, fontSize: 13 }}>{p.price}</div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{key.includes('yearly') ? 'per year' : 'per month'}</div>
              </button>
            )
          })}
        </div>
        <FeatureList items={TIER_FEATURES.basic} />

        {/* Pro */}
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8, letterSpacing: '0.5px' }}>Pro — Auto WhatsApp Reminders</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {['pro_monthly', 'pro_yearly'].map(key => {
            const p = PLANS[key]
            return (
              <button key={key} onClick={() => { openRazorpay(activeProperty, key); onClose() }}
                style={{ flex: 1, padding: '10px 8px', borderRadius: 'var(--radius)', border: '2px solid #D85A30', background: '#D85A30', color: 'white', cursor: 'pointer', position: 'relative', textAlign: 'center' }}>
                {p.save && <span style={{ position: 'absolute', top: -8, right: 4, background: '#25D366', color: 'white', fontSize: 9, padding: '2px 5px', borderRadius: 8, fontWeight: 700 }}>{p.save}</span>}
                <div style={{ fontWeight: 700, fontSize: 13 }}>{p.price}</div>
                <div style={{ fontSize: 10, opacity: 0.85, marginTop: 2 }}>{key.includes('yearly') ? 'per year' : 'per month'}</div>
              </button>
            )
          })}
        </div>
        <FeatureList items={TIER_FEATURES.pro} />

        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', marginBottom: 16 }}>
          ₹1 authorization today, actual charge from next day. Cancel anytime.
        </div>
        <button className="btn" style={{ width: '100%' }} onClick={onClose}>
          {isTrial ? 'Continue with trial' : 'Cancel'}
        </button>
      </div>
    </div>
  )
}

// ─── App Content ──────────────────────────────────────────────────────────────
function AppContent() {
  const { user, profile, properties, activeProperty, selectProperty, signOut, loading, isAdmin, isStaff, isOwner, permissions, refreshProperties } = useAuth()
  const [page, setPage] = useState('dashboard')
  const [tenantFilter, setTenantFilter] = useState('all')
  const [showPropertyMenu, setShowPropertyMenu] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [showAddProperty, setShowAddProperty] = useState(false)
  const [showManageProperties, setShowManageProperties] = useState(false)

  // ─── Auto-open Upgrade modal for trial users, once per session ─────────
  // Shown after login for anyone on a trial plan.
  // Session-scoped (sessionStorage) so dismissing hides it until next login/tab-close.
  // Pro is an owner-wide plan, not per-property — one Pro property covers every
  // property this owner has. Only Basic (1 property) and Trial are property-scoped.
  const ownerIsProElsewhere = properties.some(p => p.plan_type === 'pro' || p.plan_type === 'owned')

  useEffect(() => {
    if (!activeProperty || !user || isAdmin || isStaff) return
    if (BILLING_EXEMPT_PROPERTY_IDS.has(activeProperty.id)) return
    if (ownerIsProElsewhere) return
    if (activeProperty.plan_type !== 'trial') return

    const shownKey = `upgrade_shown_${activeProperty.id}`
    if (sessionStorage.getItem(shownKey)) return

    // Small delay so it doesn't feel abrupt right at login
    const t = setTimeout(() => {
      setShowUpgradeModal(true)
      sessionStorage.setItem(shownKey, '1')
    }, 800)
    return () => clearTimeout(t)
  }, [activeProperty, user, isAdmin, isStaff, ownerIsProElsewhere])

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
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>Contact your administrator to assign a property to your account.</div>
        <button className="btn" onClick={signOut}>Sign out</button>
      </div>
    </div>
  )

  // Trial/subscription check — skipped entirely if the owner is already Pro on
  // any of their other properties, since Pro is owner-wide, not per-property.
  if (!isAdmin && activeProperty && !BILLING_EXEMPT_PROPERTY_IDS.has(activeProperty.id) && !ownerIsProElsewhere) {
    const trialEnd = activeProperty.trial_end_date ? new Date(activeProperty.trial_end_date) : null
    const isTrialExpired = activeProperty.plan_type === 'trial' && trialEnd && trialEnd < new Date()
    const isSuspended = activeProperty.subscription_status === 'suspended' || activeProperty.subscription_status === 'expired'

    if ((isTrialExpired || isSuspended) && isStaff) {
      // Staff work under the owner's account/billing — they should never see
      // payment buttons or be able to trigger a charge. Just point them to the owner.
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 }}>
          <div className="card" style={{ maxWidth: 400, textAlign: 'center', padding: 32 }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⏰</div>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>
              {isTrialExpired ? 'Free trial has ended' : 'Subscription paused'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{activeProperty.name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
              {isTrialExpired
                ? "This property's free trial has expired. Please contact the property owner to choose a plan and continue using Pavio."
                : "This property's subscription is no longer active. Please contact the property owner to renew it."}
            </div>
            <button className="btn" onClick={signOut}>Sign out</button>
          </div>
        </div>
      )
    }

    if (isTrialExpired || isSuspended) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 }}>
          <div className="card" style={{ maxWidth: 440, textAlign: 'center', padding: 32 }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⏰</div>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>
              {isTrialExpired ? 'Your free trial has ended' : 'Subscription expired'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{activeProperty.name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
              {isTrialExpired ? 'Your 15-day free trial has expired. Choose a plan to continue using Pavio.' : 'Your subscription is no longer active.'}
            </div>

            {/* Basic plans */}
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8, letterSpacing: '0.5px' }}>Basic — Manual WhatsApp</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button onClick={() => openRazorpay(activeProperty, 'basic_monthly')}
                style={{ flex: 1, padding: '10px 8px', borderRadius: 'var(--radius)', border: '2px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                ₹499/month
              </button>
              <button onClick={() => openRazorpay(activeProperty, 'basic_yearly')}
                style={{ flex: 1, padding: '10px 8px', borderRadius: 'var(--radius)', border: '2px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', position: 'relative', fontWeight: 700, fontSize: 13 }}>
                <span style={{ position: 'absolute', top: -8, right: 4, background: '#25D366', color: 'white', fontSize: 9, padding: '2px 5px', borderRadius: 8, fontWeight: 700 }}>SAVE ₹1,989</span>
                ₹3,999/year
              </button>
            </div>
            <FeatureList items={TIER_FEATURES.basic} />

            {/* Pro plans */}
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8, letterSpacing: '0.5px' }}>Pro — Auto WhatsApp Reminders</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button onClick={() => openRazorpay(activeProperty, 'pro_monthly')}
                style={{ flex: 1, padding: '10px 8px', borderRadius: 'var(--radius)', border: 'none', background: '#D85A30', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                ₹999/month
              </button>
              <button onClick={() => openRazorpay(activeProperty, 'pro_yearly')}
                style={{ flex: 1, padding: '10px 8px', borderRadius: 'var(--radius)', border: 'none', background: '#D85A30', color: 'white', cursor: 'pointer', position: 'relative', fontWeight: 700, fontSize: 13 }}>
                <span style={{ position: 'absolute', top: -8, right: 4, background: '#25D366', color: 'white', fontSize: 9, padding: '2px 5px', borderRadius: 8, fontWeight: 700 }}>SAVE ₹3,989</span>
                ₹7,999/year
              </button>
            </div>
            <FeatureList items={TIER_FEATURES.pro} />

            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 16 }}>₹1 authorization today, actual charge from next day. Cancel anytime.</div>
            <a href={`https://wa.me/919778776405?text=Hi%20Nidhin%2C%20I%20want%20to%20upgrade%20my%20Pavio%20plan%20for%20${encodeURIComponent(activeProperty.name)}`}
              target="_blank" rel="noreferrer"
              style={{ display: 'inline-block', color: 'var(--text-secondary)', fontSize: 13, textDecoration: 'none', marginBottom: 12 }}>
              💬 Contact on WhatsApp instead
            </a>
            <br />
            <button className="btn" style={{ fontSize: 12, marginTop: 8 }} onClick={signOut}>Sign out</button>
          </div>
        </div>
      )
    }
  }

  const userRole = isAdmin ? 'admin' : isStaff ? 'staff' : 'owner'

  const ALL_PAGES = [
    { id: 'dashboard', label: 'Dashboard',            roles: ['owner', 'staff', 'admin'], permKey: 'view_dashboard' },
    { id: 'beds',      label: 'Bed map',              roles: ['owner', 'staff', 'admin'], permKey: 'view_bedmap' },
    { id: 'tenants',   label: 'Tenants',              roles: ['owner', 'staff', 'admin'], permKey: null },
    { id: 'finance',   label: 'Receipts & payments',  roles: ['owner', 'staff', 'admin'], permKey: 'add_expenses' },
    { id: 'reports',   label: 'Reports',              roles: ['owner', 'staff', 'admin'], permKey: 'view_reports' },
  ]

  const navPages = ALL_PAGES.filter(p => {
    if (!p.roles.includes(userRole)) return false
    if (isStaff && p.permKey && permissions && !permissions[p.permKey]) return false
    return true
  })

  const planBadge = () => {
    if (!activeProperty || isAdmin) return null
    const pt = activeProperty.plan_type
    if (pt === 'pro' || ownerIsProElsewhere) return { label: '⚡ Pro', color: 'var(--green)' }
    if (pt === 'basic') return { label: '📦 Basic', color: 'var(--blue)' }
    return { label: '🕐 Trial', color: 'var(--amber)' }
  }
  const badge = planBadge()

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="logo">
              <span className="logo-icon">🏠</span>
              <span className="logo-text">Pavio</span>
            </div>

            {isOwner && properties.length > 1 && (
              <div style={{ position: 'relative' }}>
                <button onClick={() => { setShowPropertyMenu(!showPropertyMenu); setShowUserMenu(false) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', fontSize: 13, fontWeight: 500, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text)', fontFamily: 'inherit' }}>
                  {activeProperty?.name || 'Select property'}
                  <span style={{ fontSize: 10, opacity: 0.6 }}>▼</span>
                </button>
                {showPropertyMenu && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 200, zIndex: 100, overflow: 'hidden' }}>
                    {properties.map(p => (
                      <div key={p.id} onClick={() => { selectProperty(p); setShowPropertyMenu(false); setPage('dashboard') }}
                        style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, background: activeProperty?.id === p.id ? 'var(--bg)' : 'transparent', fontWeight: activeProperty?.id === p.id ? 600 : 400, borderBottom: '1px solid var(--border)' }}
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

            {isStaff && activeProperty && (
              <div style={{ padding: '4px 10px', background: 'var(--blue-bg)', color: 'var(--blue)', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 500 }}>
                {activeProperty.name}
              </div>
            )}
          </div>

          <nav className="nav">
            {navPages.map(p => (
              <button key={p.id} className={`nav-btn ${page === p.id ? 'active' : ''}`}
                onClick={() => { setPage(p.id); setTenantFilter('all'); setShowPropertyMenu(false); setShowUserMenu(false) }}>
                {p.label}
              </button>
            ))}
          </nav>

          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button onClick={() => { setShowUserMenu(!showUserMenu); setShowPropertyMenu(false) }}
              style={{ width: 32, height: 32, borderRadius: '50%', background: isStaff ? 'var(--blue)' : 'var(--text)', color: 'white', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {(profile?.full_name || user?.email || 'U')[0].toUpperCase()}
            </button>
            {showUserMenu && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 220, zIndex: 100, overflow: 'hidden' }}>
                {/* Profile info */}
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{profile?.full_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{user?.email}</div>
                  <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                    {isAdmin && <span className="badge badge-blue">Admin</span>}
                    {isStaff && <span className="badge badge-green">Staff</span>}
                    {isOwner && !isAdmin && <span className="badge badge-amber">Owner</span>}
                    {badge && <span style={{ fontSize: 11, fontWeight: 600, color: badge.color }}>{badge.label}</span>}
                  </div>
                </div>

                {/* Plan info */}
                {isOwner && activeProperty && !isAdmin && (
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Current Plan</div>
                    {(activeProperty.plan_type === 'pro' || ownerIsProElsewhere) ? (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)' }}>✅ Pro — Active</span>
                          {activeProperty.plan_type === 'pro' && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>₹999/mo</span>}
                        </div>
                        {activeProperty.plan_type === 'pro' ? (
                          <button onClick={async () => {
                            if (!window.confirm('Cancel your Pro subscription?')) return
                            await fetch('https://elmqjkyyjxtbnnfbpndb.supabase.co/functions/v1/cancel-subscription', {
                              method: 'POST', headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ property_id: activeProperty.id, subscription_id: activeProperty.razorpay_subscription_id })
                            })
                            alert('Cancelled. Active until end of billing period.')
                            setShowUserMenu(false)
                          }} style={{ marginTop: 6, fontSize: 11, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                            Cancel subscription
                          </button>
                        ) : (
                          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-tertiary)' }}>
                            Included with your Pro plan on another property
                          </div>
                        )}
                      </div>
                    ) : activeProperty.plan_type === 'basic' ? (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--blue)' }}>📦 Basic — Active</span>
                          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>₹499/mo</span>
                        </div>
                        <button onClick={() => { setShowUpgradeModal(true); setShowUserMenu(false) }}
                          style={{ marginTop: 6, fontSize: 11, color: '#D85A30', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', fontWeight: 600 }}>
                          Upgrade to Pro
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--amber)' }}>
                          🕐 Trial
                          {activeProperty.trial_end_date && (
                            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 6 }}>
                              ends {new Date(activeProperty.trial_end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          )}
                        </div>
                        <button onClick={() => { setShowUpgradeModal(true); setShowUserMenu(false) }}
                          style={{ marginTop: 6, fontSize: 12, color: 'white', background: '#D85A30', border: 'none', cursor: 'pointer', padding: '4px 10px', borderRadius: 4, fontWeight: 600 }}>
                          ⚡ Upgrade
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Admin panel */}
                {isAdmin && (
                  <div onClick={() => { setPage('admin'); setShowUserMenu(false) }}
                    style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    🛡️ Admin panel
                  </div>
                )}

                {/* Settings — now also houses Staff management and Add property */}
                {isOwner && activeProperty && (
                  <div onClick={() => { setShowSettings(true); setShowUserMenu(false) }}
                    style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    ⚙️ Settings
                  </div>
                )}

                {/* Support */}
                <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
                <a href="mailto:support@pavio.tech"
                  style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  ✉️ support@pavio.tech
                </a>
                <a href="https://wa.me/919778776405" target="_blank" rel="noreferrer"
                  style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  💬 WhatsApp support
                </a>

                {/* Sign out */}
                <div onClick={() => { signOut(); setShowUserMenu(false) }}
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
        {page === 'staff' && isOwner && <StaffManager propertyId={activeProperty?.id} onUpgradeClick={() => setShowUpgradeModal(true)} />}
        {!['admin', 'staff'].includes(page) && (
          !activeProperty
            ? <div className="empty" style={{ marginTop: 60 }}>Select a property to continue</div>
            : <>
                {page === 'dashboard' && <Dashboard onNavigate={(p, filter) => { setPage(p); if (filter) setTenantFilter(filter); else setTenantFilter('all') }} propertyId={activeProperty.id} />}
                {page === 'beds' && <BedMap propertyId={activeProperty.id} isStaff={isStaff} canAddBeds={permissions?.add_beds} />}
                {page === 'tenants' && <Tenants key={tenantFilter} propertyId={activeProperty.id} isStaff={isStaff} initialFilter={tenantFilter} canAddTenants={permissions?.add_tenants} canDeleteEntries={permissions?.delete_entries} canCollectRent={permissions?.collect_rent} />}
                {page === 'finance' && <Finance propertyId={activeProperty.id} isStaff={isStaff} canDelete={permissions?.delete_entries} />}
                {page === 'reports' && (!isStaff || permissions?.view_reports) && <Reports propertyId={activeProperty.id} />}
              </>
        )}
      </main>

      {showSettings && activeProperty && (
        <SettingsModal activeProperty={activeProperty} onClose={() => setShowSettings(false)}
          onOpenStaffManagement={() => { setShowSettings(false); setPage('staff') }}
          onOpenManageProperties={() => { setShowSettings(false); setShowManageProperties(true) }} />
      )}

      {showUpgradeModal && activeProperty && (
        <UpgradeModal activeProperty={activeProperty} onClose={() => setShowUpgradeModal(false)} />
      )}

      {showAddProperty && (
        <AddPropertyModal
          userId={user?.id}
          onClose={() => setShowAddProperty(false)}
          onCreated={(newProperty) => {
            refreshProperties()
            if (newProperty) selectProperty(newProperty)
          }}
        />
      )}

      {showManageProperties && (
        <ManagePropertiesModal
          userId={user?.id}
          properties={properties}
          activeProperty={activeProperty}
          onClose={() => setShowManageProperties(false)}
          onDeleted={(deletedId) => {
            const remaining = properties.filter(p => p.id !== deletedId)
            refreshProperties()
            if (activeProperty?.id === deletedId && remaining[0]) selectProperty(remaining[0])
          }}
          onUpdated={(updatedId, newGpay) => {
            if (activeProperty?.id === updatedId) activeProperty.gpay_number = newGpay
            refreshProperties()
          }}
          onOpenAddProperty={() => { setShowManageProperties(false); setShowAddProperty(true) }}
          showAddProperty={!isAdmin && properties.some(p => p.plan_type === 'pro' || p.plan_type === 'owned')}
        />
      )}
    </div>
  )
}

export default function App() {
  const path = window.location.pathname
  const isNative = Capacitor.isNativePlatform()

  // Marketing landing page — only for web browsers hitting the root URL.
  // The installed Android app (Capacitor) always skips this and goes
  // straight into the existing login/dashboard flow, so the current APK
  // needs no changes at all.
  if (!isNative && (path === '/' || path === '')) {
    return <Landing />
  }

  // Self-signup page for new hostel owners — browsers only.
  if (!isNative && path === '/signup') {
    return <Signup />
  }

  if (path === '/reset-password') {
    return (
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    )
  }
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
