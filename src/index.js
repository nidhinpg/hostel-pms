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
