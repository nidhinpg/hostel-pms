import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Capacitor } from '@capacitor/core'

const SIGNUP_FN_URL = 'https://elmqjkyyjxtbnnfbpndb.supabase.co/functions/v1/signup-owner'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsbXFqa3l5anh0Ym5uZmJwbmRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUyNDI0MDQsImV4cCI6MjA2MDgxODQwNH0.eVSHJCGCOi5j1zT40KGqHsRXbXDCwx8NJNC09zkahQE'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState('login') // 'login' | 'forgot' | 'signup'
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Signup-only fields (email/password above are shared with the login form)
  const [signupForm, setSignupForm] = useState({ full_name: '', property_name: '', city: '', gpay_number: '', address: '' })
  const [signupLoading, setSignupLoading] = useState(false)
  const setSignupField = (k) => (e) => setSignupForm(p => ({ ...p, [k]: e.target.value }))

  // Web (pavio.tech) sends new owners to the standalone /signup marketing page.
  // Inside the Android app there's no server-side routing, so signup is an
  // embedded step of this same screen instead (mode === 'signup').
  const isNative = Capacitor.isNativePlatform()

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const err = await signIn(email, password)
    if (err) setError(err.message)
    setLoading(false)
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    if (!email) { setError('Enter your email address first'); return }
    setError('')
    setResetLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: \`\${window.location.origin}/reset-password\`
    })
    if (error) {
      setError(error.message)
    } else {
      setResetSent(true)
    }
    setResetLoading(false)
  }

  const handleSignup = async (e) => {
    e.preventDefault()
    setError('')

    if (!signupForm.full_name.trim()) { setError('Please enter your full name.'); return }
    if (!email.trim()) { setError('Please enter your email.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (!signupForm.property_name.trim()) { setError('Please enter your property name.'); return }

    setSignupLoading(true)
    try {
      const res = await fetch(SIGNUP_FN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({
          full_name: signupForm.full_name.trim(),
          email: email.trim().toLowerCase(),
          password,
          property_name: signupForm.property_name.trim(),
          city: signupForm.city.trim(),
          gpay_number: signupForm.gpay_number.trim(),
          address: signupForm.address.trim(),
        })
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok || data.error) {
        setError(data.error || 'Signup failed. Please try again.')
        setSignupLoading(false)
        return
      }

      // Auto sign in. Once the session is set, AuthProvider picks it up and this
      // Login screen unmounts on its own — no manual redirect needed here.
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (signInErr) {
        setError('Account created! Please sign in below.')
        setMode('login')
        setSignupLoading(false)
        return
      }
    } catch (err) {
      setError(err?.message || 'Unexpected error. Please try again.')
      setSignupLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg)', padding: 20
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo + Brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: '#D85A30', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px'
          }}>
            <svg width="38" height="38" viewBox="0 0 48 48" fill="none">
              <circle cx="20" cy="24" r="10" stroke="white" strokeWidth="2.5" fill="none"/>
              <line x1="28" y1="16" x2="40" y2="38" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="20" cy="24" r="4" fill="white"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text)', marginBottom: 4, letterSpacing: '-0.5px' }}>
            Pavio
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {mode === 'login' ? 'Sign in to manage your property' : mode === 'forgot' ? 'Reset your password' : 'Create your account — 15-day free trial'}
          </p>
        </div>

        <div className="card">
          {mode === 'login' && (
            <form onSubmit={handleLogin}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label>Email address</label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label style={{ margin: 0 }}>Password</label>
                    <button
                      type="button"
                      onClick={() => { setMode('forgot'); setError('') }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--blue)', padding: 0 }}>
                      Forgot password?
                    </button>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      style={{ width: '100%', paddingRight: 40, boxSizing: 'border-box' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute', right: 10, top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: 0, color: 'var(--text-secondary)', fontSize: 16
                      }}>
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                {error && (
                  <div style={{ background: 'var(--red-bg)', color: 'var(--red)', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '10px', fontSize: 14, justifyContent: 'center', background: '#D85A30', borderColor: '#D85A30' }}
                  disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign in'}
                </button>
              </div>
            </form>
          )}

          {mode === 'forgot' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {resetSent ? (
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>📧</div>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Check your email</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                    Password reset link sent to <strong>{email}</strong>
                  </div>
                  <button className="btn" style={{ width: '100%' }} onClick={() => { setMode('login'); setResetSent(false) }}>
                    Back to sign in
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="form-group">
                      <label>Email address</label>
                      <input
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        autoFocus
                      />
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg)', padding: '10px 12px', borderRadius: 6 }}>
                      We'll send a password reset link to your email.
                    </div>

                    {error && (
                      <div style={{ background: 'var(--red-bg)', color: 'var(--red)', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
                        {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      className="btn btn-primary"
                      style={{ width: '100%', padding: '10px', fontSize: 14, justifyContent: 'center', background: '#D85A30', borderColor: '#D85A30' }}
                      disabled={resetLoading}>
                      {resetLoading ? 'Sending...' : 'Send reset link'}
                    </button>
                    <button
                      type="button"
                      className="btn"
                      style={{ width: '100%', padding: '10px', fontSize: 14, justifyContent: 'center' }}
                      onClick={() => { setMode('login'); setError('') }}>
                      Back to sign in
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {mode === 'signup' && (
            <form onSubmit={handleSignup}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label>Full name</label>
                  <input
                    type="text"
                    placeholder="Your name"
                    value={signupForm.full_name}
                    onChange={setSignupField('full_name')}
                    autoComplete="name"
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label>Email address</label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      autoComplete="new-password"
                      minLength={6}
                      required
                      style={{ width: '100%', paddingRight: 40, boxSizing: 'border-box' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute', right: 10, top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: 0, color: 'var(--text-secondary)', fontSize: 16
                      }}>
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 4, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.5px' }}>
                  Property details
                </div>

                <div className="form-group">
                  <label>Property name</label>
                  <input
                    type="text"
                    placeholder="e.g. Blue Nest Stays"
                    value={signupForm.property_name}
                    onChange={setSignupField('property_name')}
                    required
                  />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>City</label>
                    <input
                      type="text"
                      placeholder="e.g. Kochi"
                      value={signupForm.city}
                      onChange={setSignupField('city')}
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>GPay number</label>
                    <input
                      type="tel"
                      placeholder="10 digits"
                      value={signupForm.gpay_number}
                      onChange={setSignupField('gpay_number')}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Address</label>
                  <textarea
                    rows={2}
                    placeholder="Property address (optional)"
                    value={signupForm.address}
                    onChange={setSignupField('address')}
                    style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
                  />
                </div>

                <div style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg)', padding: '10px 12px', borderRadius: 6 }}>
                  Your account starts with a <strong style={{ color: 'var(--text)' }}>15-day free trial</strong> — full access, no card needed.
                </div>

                {error && (
                  <div style={{ background: 'var(--red-bg)', color: 'var(--red)', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '10px', fontSize: 14, justifyContent: 'center', background: '#D85A30', borderColor: '#D85A30' }}
                  disabled={signupLoading}>
                  {signupLoading ? 'Creating account...' : 'Create account'}
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{ width: '100%', padding: '10px', fontSize: 14, justifyContent: 'center' }}
                  onClick={() => { setMode('login'); setError('') }}>
                  Back to sign in
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Sign up link/button — web (pavio.tech) sends users to the standalone
            /signup page; the app switches this same screen into signup mode. */}
        {mode === 'login' && (
          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)', marginTop: 20 }}>
            New to Pavio?{' '}
            {isNative ? (
              <button
                type="button"
                onClick={() => { setMode('signup'); setError('') }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#D85A30', fontWeight: 600, fontSize: 13, textDecoration: 'none', fontFamily: 'inherit' }}>
                Create an account
              </button>
            ) : (
              <a href="/signup" style={{ color: '#D85A30', fontWeight: 600, textDecoration: 'none' }}>
                Create an account
              </a>
            )}
          </p>
        )}

        {/* Support contact — shown on login and signup, both web and app */}
        {(mode === 'login' || mode === 'signup') && (
          <div style={{ textAlign: 'center', marginTop: 16, display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
            <a href="mailto:support@pavio.tech" style={{ fontSize: 12, color: 'var(--text-tertiary)', textDecoration: 'none' }}>
              ✉ support@pavio.tech
            </a>
            <a href="https://wa.me/919778776405" target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--text-tertiary)', textDecoration: 'none' }}>
              💬 WhatsApp support
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
