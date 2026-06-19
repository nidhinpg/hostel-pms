import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleReset = async (e) => {
    e.preventDefault()
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
    } else {
      setDone(true)
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg)', padding: 20
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏠</div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
            Hosteloops PMS
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {done ? 'Password updated!' : 'Set your new password'}
          </p>
        </div>

        <div className="card">
          {done ? (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>✅</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Password changed successfully</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                You can now sign in with your new password.
              </div>
              <a href="/" style={{ display: 'block' }}>
                <button className="btn btn-primary" style={{ width: '100%', padding: '10px', fontSize: 14 }}>
                  Go to sign in
                </button>
              </a>
            </div>
          ) : (
            <form onSubmit={handleReset}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label>New password</label>
                  <input
                    type="password"
                    placeholder="Min 6 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label>Confirm new password</label>
                  <input
                    type="password"
                    placeholder="Re-enter password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                  />
                </div>

                {error && (
                  <div style={{ background: 'var(--red-bg)', color: 'var(--red)', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '10px', fontSize: 14, justifyContent: 'center' }}
                  disabled={loading}>
                  {loading ? 'Updating...' : 'Set new password'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
