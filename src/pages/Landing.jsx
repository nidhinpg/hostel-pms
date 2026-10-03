import './Landing.css'

const LOGO = (
  <svg className="logo-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="24" height="24">
    <rect width="512" height="512" fill="#D85A30" />
    <circle cx="210" cy="256" r="110" stroke="white" strokeWidth="36" fill="none" />
    <line x1="298" y1="156" x2="420" y2="390" stroke="white" strokeWidth="36" strokeLinecap="round" />
    <circle cx="210" cy="256" r="44" fill="white" />
  </svg>
)

export default function Landing() {
  return (
    <div className="landing">
      <nav className="topnav">
        <div className="topnav-inner">
          <div className="logo">{LOGO} pavio</div>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="/app" className="btn" style={{ padding: '7px 14px' }}>Log in</a>
            <a href="/signup" className="btn btn-brand">Sign up</a>
          </div>
        </div>
      </nav>

      <header className="hero wrap">
        <div className="hero-grid">
          <div className="hero-copy">
            <span className="eyebrow-pill">🏠 Built for small hostels &amp; PGs</span>
            <h1>Run your property without an Excel sheet that's <span className="hl">one formula away from breaking</span>.</h1>
            <p className="lead">Pavio is a simple, affordable PMS built by a working hostel operator — bed tracking, rent collection, and staff management, priced for properties that can't justify a hotel-chain platform.</p>

            <div className="manage-pills">
              <span className="pill pill-orange">🏨 Hostels</span>
              <span className="pill pill-green">🛏️ PGs</span>
              <span className="pill pill-blue">🏘️ Co-living</span>
            </div>

            <div className="hero-ctas">
              <a href="/signup" className="btn btn-brand btn-lg">Get started free →</a>
              <a href="https://play.google.com/store/apps/details?id=com.pavio.app" target="_blank" rel="noreferrer" className="play-badge">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 135 40" width="135" height="40">
                  <rect width="135" height="40" rx="6" fill="#000"/>
                  <text x="44" y="13" fill="#fff" fontFamily="'DM Sans',sans-serif" fontSize="8" letterSpacing="0.3">GET IT ON</text>
                  <text x="44" y="28" fill="#fff" fontFamily="'DM Sans',sans-serif" fontSize="15" fontWeight="600" letterSpacing="-0.3">Google Play</text>
                  <path d="M12 8 L12 32 L26 20 Z" fill="#4CAF50"/>
                  <path d="M12 8 L26 20 L30 16 L16 8 Z" fill="#81C784"/>
                  <path d="M12 32 L26 20 L30 24 L16 32 Z" fill="#F44336"/>
                  <path d="M26 20 L30 16 L34 20 L30 24 Z" fill="#FFCA28"/>
                </svg>
              </a>
            </div>
            <div className="hero-note">No card required &middot; 15-day trial &middot; set up your first property in under 10 minutes</div>
          </div>

          <div className="hero-visual">
            <div className="blob"></div>
            <div className="callout callout-1">💬 Rent reminders sent automatically on WhatsApp</div>
            <div className="phone">
              <div className="phone-notch"></div>
              <div className="phone-screen">
                <div className="mock-head">
                  <h4>Bed map</h4>
                  <span className="mock-add">+ Add bed</span>
                </div>
                <div className="mock-summary">
                  <span className="mock-pill badge-green">34 Occupied</span>
                  <span className="mock-pill badge-amber">6 Vacant</span>
                  <span className="mock-pill badge-red">3 Rent due</span>
                </div>
                <div className="mock-room-head"><span>Room 104 &middot; 6 beds</span><span>Full</span></div>
                <div className="bed-grid">
                  <div className="bed-card occupied"><span className="bed-num">104A</span><span className="bed-name">Rahul</span></div>
                  <div className="bed-card occupied"><span className="flag-dot">!</span><span className="bed-num">104B</span><span className="bed-name">Sanjay</span></div>
                  <div className="bed-card occupied"><span className="bed-num">104C</span><span className="bed-name">Nithin</span></div>
                  <div className="bed-card occupied"><span className="flag-dot">!</span><span className="bed-num">104D</span><span className="bed-name">Farhan</span></div>
                  <div className="bed-card occupied"><span className="bed-num">104E</span><span className="bed-name">Vishnu</span></div>
                  <div className="bed-card occupied"><span className="bed-num">104F</span><span className="bed-name">Kiran</span></div>
                </div>
              </div>
            </div>
            <div className="callout callout-2">🛏️ Live bed map, updated instantly</div>
          </div>
        </div>
      </header>

      <section className="stats wrap">
        <div className="stats-inner">
          <div className="stat">
            <div className="stat-ic">💰</div>
            <div className="stat-val">₹499<span style={{ fontSize: '13px' }}>/mo</span></div>
            <div className="stat-label">Starting price, per property</div>
          </div>
          <div className="stat">
            <div className="stat-ic">⚡</div>
            <div className="stat-val">10 min</div>
            <div className="stat-label">To set up your first property</div>
          </div>
          <div className="stat">
            <div className="stat-ic">🔒</div>
            <div className="stat-val">1–2 sec</div>
            <div className="stat-label">Staff permission sync time</div>
          </div>
        </div>
      </section>

      <section className="section wrap">
        <div className="section-head">
          <span className="eyebrow-pill eyebrow-pill-alt">Why Pavio exists</span>
          <h2>Built while actually running a hostel — not for one.</h2>
          <p>Most PMS platforms are priced and designed for hotel chains. Pavio was built by an operator managing real bookings, real rent collection, and real staff — for properties exactly that size.</p>
        </div>
        <div className="compare">
          <div className="card old">
            <h3>Without Pavio</h3>
            <ul className="compare-list">
              <li><span className="ic">–</span>A register only one person can read</li>
              <li><span className="ic">–</span>Rent reminders typed out by hand on WhatsApp</li>
              <li><span className="ic">–</span>An Excel sheet with a formula nobody wants to touch</li>
              <li><span className="ic">–</span>No live view of which beds are actually free</li>
            </ul>
          </div>
          <div className="card new">
            <h3>With Pavio</h3>
            <ul className="compare-list">
              <li><span className="ic">✓</span>A live bed map any staff member can check</li>
              <li><span className="ic">✓</span>Rent reminders sent automatically over WhatsApp</li>
              <li><span className="ic">✓</span>One dashboard, always accurate, from any phone</li>
              <li><span className="ic">✓</span>Staff accounts scoped to exactly what they need</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="section wrap dotted-bg" id="features" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <span className="eyebrow-pill eyebrow-pill-alt">What's included</span>
          <h2>Everything a small property runs on daily.</h2>
          <p>No hotel-chain features you'll never open — just the tools a hostel or PG actually needs.</p>
        </div>
        <div className="feat-grid">
          <div className="card feat">
            <div className="fic" style={{ background: 'var(--blue-bg)' }}>🛏️</div>
            <h3>Live bed map</h3>
            <p>See every room and bed at a glance — occupied, vacant, or rent overdue — updated in real time.</p>
          </div>
          <div className="card feat">
            <div className="fic" style={{ background: 'var(--green-bg)' }}>💬</div>
            <h3>WhatsApp rent reminders</h3>
            <p>Automated reminders go out on the due date. No manual typing, no missed follow-ups.</p>
          </div>
          <div className="card feat">
            <div className="fic" style={{ background: 'var(--amber-bg)' }}>👥</div>
            <h3>Staff &amp; permissions</h3>
            <p>Add staff accounts with exactly the access they need — front desk, accounts, or full admin.</p>
          </div>
          <div className="card feat">
            <div className="fic" style={{ background: 'var(--red-bg)' }}>🏘️</div>
            <h3>Multi-property ready</h3>
            <p>Running more than one hostel or PG? Manage every property from a single login.</p>
          </div>
          <div className="card feat">
            <div className="fic" style={{ background: 'var(--blue-bg)' }}>📱</div>
            <h3>Mobile-first</h3>
            <p>Built for a phone at the front desk, not a desktop you check once a week.</p>
          </div>
          <div className="card feat">
            <div className="fic" style={{ background: 'var(--green-bg)' }}>💰</div>
            <h3>Priced for small properties</h3>
            <p>A fraction of what hotel-chain platforms charge, because that's the budget you're actually working with.</p>
          </div>
        </div>
      </section>

      <section className="section wrap" id="pricing" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <span className="eyebrow-pill eyebrow-pill-alt">Pricing</span>
          <h2>Simple plans. No surprises.</h2>
          <p>Start free. Upgrade only once Pavio is already saving you time.</p>
        </div>
        <div className="price-grid">
          <div className="card price-card">
            <div className="price-top"><span className="price-tier">Trial</span></div>
            <div className="price-amt">Free</div>
            <div className="price-sub">15 days, full access</div>
            <ul className="price-feats">
              <li>1 property</li>
              <li>Bed map &amp; tenant records</li>
              <li>Manual rent tracking</li>
              <li>Email support</li>
            </ul>
            <a href="/signup" className="btn">Sign up</a>
          </div>
          <div className="card price-card">
            <div className="price-top"><span className="price-tier">Basic</span></div>
            <div className="price-amt">₹499<span>/mo</span></div>
            <div className="price-sub">₹3,999/year — save ₹1,989</div>
            <ul className="price-feats">
              <li style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Everything in Trial, plus:</li>
              <li>Tap a button to open WhatsApp, you hit send</li>
              <li>Finance reports — CSV &amp; PDF export</li>
            </ul>
            <a href="/signup" className="btn">Choose Basic</a>
          </div>
          <div className="card price-card pop">
            <div className="price-top">
              <span className="price-tier">Pro</span>
              <span className="badge-popular">⭐ Popular</span>
            </div>
            <div className="price-amt">₹999<span>/mo</span></div>
            <div className="price-sub">₹7,999/year — save ₹3,989</div>
            <ul className="price-feats">
              <li>Unlimited properties</li>
              <li>Staff logins with permission controls</li>
              <li>WhatsApp reminders sent automatically, every day</li>
              <li>Push notifications for rent due</li>
              <li>Priority WhatsApp support</li>
            </ul>
            <a href="/signup" className="btn btn-brand">Choose Pro</a>
          </div>
        </div>
      </section>

      <section className="wrap" style={{ paddingBottom: '80px' }}>
        <div className="closing">
          <div className="closing-dots"></div>
          <h2>Stop running your hostel from three different apps.</h2>
          <p>Set up your first property in under 10 minutes. No credit card required.</p>
          <a href="/signup" className="btn btn-primary" style={{ background: '#fff', color: 'var(--text)', borderColor: '#fff' }}>Sign up</a>
        </div>
      </section>

      <footer>
        <div className="wrap foot-inner">
          <span className="logo" style={{ fontSize: '14.5px', color: 'var(--text)' }}>{LOGO} pavio</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <a href="mailto:support@pavio.tech" style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              ✉ support@pavio.tech
            </a>
            <a href="https://wa.me/919778776405" target="_blank" rel="noreferrer" style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              💬 WhatsApp
            </a>
            <a href="https://play.google.com/store/apps/details?id=com.pavio.app" target="_blank" rel="noreferrer" className="play-badge play-badge-sm">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 32" width="110" height="32">
                <rect width="110" height="32" rx="5" fill="#1a1916"/>
                <text x="36" y="11" fill="#fff" fontFamily="'DM Sans',sans-serif" fontSize="6.5" letterSpacing="0.3">GET IT ON</text>
                <text x="36" y="23" fill="#fff" fontFamily="'DM Sans',sans-serif" fontSize="12" fontWeight="600" letterSpacing="-0.3">Google Play</text>
                <path d="M10 7 L10 25 L21 16 Z" fill="#4CAF50"/>
                <path d="M10 7 L21 16 L24 13 L13 7 Z" fill="#81C784"/>
                <path d="M10 25 L21 16 L24 19 L13 25 Z" fill="#F44336"/>
                <path d="M21 16 L24 13 L27 16 L24 19 Z" fill="#FFCA28"/>
              </svg>
            </a>
            <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>&copy; 2026 Pavio</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
