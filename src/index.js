import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(<React.StrictMode><App /></React.StrictMode>)


// Mobile: label table cells with their column header so CSS can target columns on small screens
function labelTables() {
  document.querySelectorAll('table').forEach(table => {
    const heads = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim())
    if (!heads.length) return
    table.querySelectorAll('tr').forEach(tr => {
      Array.from(tr.children).forEach((cell, i) => {
        const label = cell.colSpan > 1 ? '' : (heads[i] || '')
        if (cell.getAttribute('data-label') !== label) cell.setAttribute('data-label', label)
      })
    })
  })
}
let labelQueued = false
new MutationObserver(() => {
  if (labelQueued) return
  labelQueued = true
  requestAnimationFrame(() => { labelQueued = false; labelTables() })
}).observe(document.body, { childList: true, subtree: true })

// Mobile: keep the field being typed in visible above the on-screen keyboard
;(function keyboardFix() {
  const style = document.createElement('style')
  style.textContent = '@media (max-width: 640px) { .modal-overlay { padding-bottom: var(--kb, 0px) !important; align-items: flex-start !important; } .modal { max-height: calc(var(--vvh, 100vh) - 16px) !important; overflow-y: auto; } }'
  document.head.appendChild(style)
  const vv = window.visualViewport
  const isField = el => el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)
  const reveal = () => {
    const el = document.activeElement
    if (isField(el)) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }
  if (vv) {
    const update = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      document.documentElement.style.setProperty('--kb', kb + 'px')
      document.documentElement.style.setProperty('--vvh', vv.height + 'px')
      if (kb > 80) setTimeout(reveal, 60)
    }
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
  }
  document.addEventListener('focusin', e => { if (isField(e.target)) setTimeout(reveal, 350) })
})()
