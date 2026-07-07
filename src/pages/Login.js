import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Capacitor } from '@capacitor/core'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState('login') // 'login' | 'forgot'
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Only show the "Sign up" link in web browsers, not inside the Android app.
  // (Inside the app, /signup is not a route — new-owner self-signup happens on pavio.tech.)
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
      redirectTo: `${window.location.origin}/reset-password`
    })
    if (error) {
      setError(error.message)
    } else {
      setResetSent(true)
    }
    setResetLoading(false)
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
            {mode === 'login' ? 'Sign in to manage your property' : 'Reset your password'}
          </p>
        </div>

        <div className="card">
          {mode === 'login' ? (
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
          ) : (
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
        </div>

        {/* Sign up link — only shown on the web (pavio.tech). Hidden inside the mobile app. */}
        {!isNative && mode === 'login' && (
          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)', marginTop: 20 }}>
            New to Pavio?{' '}
            <a href="/signup" style={{ color: '#D85A30', fontWeight: 600, textDecoration: 'none' }}>
              Create an account
            </a>
          </p>
        )}

        {/* Support contact — shown on both web and app */}
        {mode === 'login' && (
          <div style={{ textAlign: 'center', marginTop: 16, display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
            <a href="mailto:support@pavio.tech" style={{ fontSize: 12, color: 'var(--text-tertiary)', textDecoration: 'none' }}>
              ✉ support@pavio.tech
            </a>
            <a href="https://wa.me/919778776405" target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--text-tertiary)', textDecoration: 'none' }}>
              💬 WhatsApp support
            </a>
          </div>
        )}

        {/* App-only footer message */}
        {isNative && (
          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>
            Don't have an account? Visit pavio.tech to sign up.
          </p>
        )}
      </div>
    </div>
  )
}
