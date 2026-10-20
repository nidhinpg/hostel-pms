import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(<React.StrictMode><App /></React.StrictMode>)


// Mobile: label each table cell with its column header so CSS can show tables as cards on small screens
function labelTables() {
  document.querySelectorAll('table').forEach(table => {
    const heads = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim())
    if (heads.length < 4) return
    table.classList.add('rt-cards')
    table.querySelectorAll('tbody tr').forEach(tr => {
      Array.from(tr.children).forEach((td, i) => {
        const label = td.colSpan > 1 ? '' : (heads[i] || '')
        if (td.getAttribute('data-label') !== label) td.setAttribute('data-label', label)
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
