import { useRef, useLayoutEffect, useState } from 'react'

const SHORT = { dashboard: 'Home', beds: 'Beds', tenants: 'Tenants', finance: 'Money', reports: 'Reports' }

const ICON = {
  dashboard: ['M5 12l-2 0l9 -9l9 9l-2 0', 'M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7', 'M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6'],
  beds: ['M3 7v11', 'M3 14h18', 'M21 18v-8a2 2 0 0 0 -2 -2h-8v6', 'M7 10a1 1 0 1 0 2 0a1 1 0 1 0 -2 0'],
  tenants: ['M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0', 'M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2', 'M16 3.13a4 4 0 0 1 0 7.75', 'M21 21v-2a4 4 0 0 0 -3 -3.85'],
  finance: ['M17 8v-3a1 1 0 0 0 -1 -1h-10a2 2 0 0 0 0 4h12a1 1 0 0 1 1 1v3m0 4v3a1 1 0 0 1 -1 1h-12a2 2 0 0 1 -2 -2v-12', 'M20 12v4h-4a2 2 0 0 1 0 -4h4'],
  reports: ['M3 13a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -6', 'M15 9a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -10', 'M9 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -14'],
}

// Phone-only top tab bar: icon + short label, sliding orange underline, swipe to change tab
export default function MobileTabs({ navPages, page, onNavigate, onSwipe }) {
  const barRef = useRef(null)
  const btnRefs = useRef({})
  const touchRef = useRef(null)
  const [ind, setInd] = useState({ left: 0, width: 0 })

  useLayoutEffect(() => {
    const b = btnRefs.current[page]
    if (!b) { setInd({ left: 0, width: 0 }); return }
    setInd({ left: b.offsetLeft, width: b.offsetWidth })
    const bar = barRef.current
    if (bar && bar.scrollWidth > bar.clientWidth + 2) {
      bar.scrollTo({ left: b.offsetLeft - (bar.clientWidth - b.offsetWidth) / 2, behavior: 'smooth' })
    }
  }, [page, navPages.length])

  const onTouchStart = (e) => {
    const bar = barRef.current
    if (bar && bar.scrollWidth > bar.clientWidth + 2) { touchRef.current = null; return }
    const t = e.touches[0]
    touchRef.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e) => {
    const s = touchRef.current
    touchRef.current = null
    if (!s) return
    const t = e.changedTouches[0]
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) onSwipe(dx < 0 ? 1 : -1)
  }

  return (
    <div className="m-tabs" ref={barRef} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="m-tabs-inner">
        {navPages.map(p => (
          <button key={p.id} ref={el => { btnRefs.current[p.id] = el }}
            className={'m-tab' + (page === p.id ? ' act' : '')} onClick={() => onNavigate(p.id)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {(ICON[p.id] || []).map((d, i) => <path key={i} d={d} />)}
            </svg>
            <span>{p.label || SHORT[p.id]}</span>
          </button>
        ))}
        <span className="m-tab-ind" style={{ transform: 'translateX(' + ind.left + 'px)', width: ind.width }} />
      </div>
    </div>
  )
}
