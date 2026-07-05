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
    property_name: '',
    city: '',
    gpay_number: '',
    address: '',
    plan: 'trial',
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

          <div className="signup-section">Choose a plan</div>

          <div className="signup-plan-choice">
            <label className={form.plan === 'trial' ? 'selected' : ''}>
              <input type="radio" name="plan" value="trial" checked={form.plan === 'trial'} onChange={set('plan')} />
              <div className="signup-plan-top">
                <span className="signup-plan-name">Trial</span>
                <span className="signup-plan-price">Free · 15 days</span>
              </div>
              <ul className="signup-plan-feats">
                <li>1 property, full access</li>
                <li>Bed map, tenant records, manual rent tracking</li>
                <li>No card required — try before you decide</li>
              </ul>
            </label>

            <label className={form.plan === 'basic' ? 'selected' : ''}>
              <input type="radio" name="plan" value="basic" checked={form.plan === 'basic'} onChange={set('plan')} />
              <div className="signup-plan-top">
                <span className="signup-plan-name">Basic</span>
                <span className="signup-plan-price">₹499/mo · ₹3,999/yr</span>
              </div>
              <ul className="signup-plan-feats">
                <li>Everything in Trial</li>
                <li>Tap a button to open WhatsApp, you hit send</li>
                <li>Finance reports — CSV & PDF export</li>
              </ul>
            </label>

            <label className={'pro ' + (form.plan === 'pro' ? 'selected' : '')}>
              <input type="radio" name="plan" value="pro" checked={form.plan === 'pro'} onChange={set('plan')} />
              <div className="signup-plan-top">
                <span className="signup-plan-name">Pro</span>
                <span className="signup-plan-price">₹999/mo · ₹7,999/yr</span>
              </div>
              <ul className="signup-plan-feats">
                <li><strong>Unlimited properties</strong></li>
                <li><strong>Fully automatic WhatsApp reminders</strong> — sent daily, no manual work</li>
                <li>Staff logins with permission controls</li>
                <li>Push notifications for rent due</li>
                <li>Priority WhatsApp support</li>
              </ul>
            </label>
          </div>

          <div className="signup-note">
            {form.plan === 'trial'
              ? 'You can upgrade to Basic or Pro anytime from inside the app.'
              : 'Your account starts on a 15-day free trial. Payment is collected only after that.'}
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
