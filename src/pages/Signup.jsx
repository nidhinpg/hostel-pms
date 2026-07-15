import { useState } from 'react'
import { supabase } from '../lib/supabase'
import './Signup.css'

const SIGNUP_FN_URL = 'https://elmqjkyyjxtbnnfbpndb.supabase.co/functions/v1/signup-owner'

const LOGO = (
  <svg className="logo-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="26" height="26">
    <rect width="512" height="512" fill="#D85A30" />
    <circle cx="210" cy="256" r="110" stroke="white" strokeWidth="36" fill="none" />
    <line x1="298" y1="156" x2="420" y2="390" stroke="white" strokeWidth="36" strokeLinecap="round" />
    <circle cx="210" cy="256" r="44" fill="white" />
  </svg>
)

export default function Signup() {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    phone: '',
    property_name: '',
    city: '',
    gpay_number: '',
    address: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Basic client validation
    if (!form.full_name.trim()) return setError('Please enter your full name.')
    if (!form.email.trim()) return setError('Please enter your email.')
    if (form.password.length < 6) return setError('Password must be at least 6 characters.')
    if (!form.phone.trim() || form.phone.trim().length < 10) return setError('Please enter a valid phone number.')
    if (!form.property_name.trim()) return setError('Please enter your property name.')

    setLoading(true)
    try {
      const res = await fetch(SIGNUP_FN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          phone: form.phone.trim(),
          property_name: form.property_name.trim(),
          city: form.city.trim(),
          gpay_number: form.gpay_number.trim(),
          address: form.address.trim(),
        }),
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        setError(data.error || 'Signup failed. Please try again.')
        setLoading(false)
        return
      }

      // Auto-login the new user
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: form.email.trim().toLowerCase(),
        password: form.password,
      })

      if (signInErr) {
        // Account was created but sign-in failed — send them to /app to log in manually
        window.location.href = '/app'
        return
      }

      // Success! Redirect into the app.
      window.location.href = '/app'
    } catch (err) {
      setError(err?.message || 'Unexpected error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="signup-wrap">
      <div className="signup-inner">
        <div className="signup-brand">{LOGO} pavio</div>
        <div className="signup-tag">Create your account · 15-day free trial · no card required</div>

        <form className="signup-card" onSubmit={handleSubmit}>
          {error && <div className="signup-error">{error}</div>}

          <div className="signup-section">Owner details</div>

          <div className="signup-field">
            <label>Full name <span className="req">*</span></label>
            <input type="text" value={form.full_name} onChange={set('full_name')} autoComplete="name" required />
          </div>

          <div className="signup-field">
            <label>Email <span className="req">*</span></label>
            <input type="email" value={form.email} onChange={set('email')} autoComplete="email" required />
          </div>

          <div className="signup-field">
            <label>Password <span className="req">*</span></label>
            <input type="password" value={form.password} onChange={set('password')} autoComplete="new-password" minLength={6} required />
          </div>

          <div className="signup-field">
            <label>Phone number <span className="req">*</span></label>
            <input type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" placeholder="10 digits" required />
          </div>

          <div className="signup-section">Property details</div>

          <div className="signup-field">
            <label>Property name <span className="req">*</span></label>
            <input type="text" value={form.property_name} onChange={set('property_name')} placeholder="e.g. Blue Nest Stays" required />
          </div>

          <div className="signup-row">
            <div className="signup-field">
              <label>City</label>
              <input type="text" value={form.city} onChange={set('city')} placeholder="e.g. Kochi" />
            </div>
            <div className="signup-field">
              <label>GPay number</label>
              <input type="tel" value={form.gpay_number} onChange={set('gpay_number')} placeholder="10 digits" />
            </div>
          </div>

          <div className="signup-field">
            <label>Address</label>
            <textarea value={form.address} onChange={set('address')} rows={2} placeholder="Property address (optional)" />
          </div>

          <div className="signup-note" style={{ marginTop: 20 }}>
            Your account starts with a <strong style={{ color: 'var(--text)' }}>15-day free trial</strong> — full access, no card needed. Upgrade to Basic or Pro anytime from inside the app.
          </div>

          <button type="submit" className="signup-submit" disabled={loading}>
            {loading ? 'Creating your account…' : 'Create account'}
          </button>

          <div className="signup-footer">
            Already have an account? <a href="/app">Log in</a>
          </div>
        </form>
      </div>
    </div>
  )
}
