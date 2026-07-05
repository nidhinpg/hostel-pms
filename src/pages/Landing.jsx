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
            <a href="#pricing" className="btn btn-primary" style={{ padding: '8px 16px' }}>Sign up</a>
          </div>
        </div>
      </nav>

      <header className="hero wrap">
        <div className="hero-top">
          <span className="eyebrow">Property management for small hostels &amp; PGs</span>
          <h1>Run your property without an Excel sheet that's one formula away from breaking.</h1>
          <p className="lead">Pavio is a simple, affordable PMS built by a working hostel operator — bed tracking, rent collection, and staff management, priced for properties that can't justify a hotel-chain platform.</p>
          <div className="hero-ctas">
            <a href="#pricing" className="btn btn-primary">Sign up</a>
          </div>
          <div className="hero-note">No card required &middot; 15-day trial &middot; set up your first property in under 10 minutes</div>
        </div>

        <div className="mock">
          <div className="mock-bar">
            <span className="mock-dot"></span><span className="mock-dot"></span><span className="mock-dot"></span>
            <span className="mock-url">pavio.tech/bedmap</span>
          </div>
          <div className="mock-body">
            <div className="mock-head">
              <h4>Bed map</h4>
              <span className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '12.5px' }}>+ Add bed</span>
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
      </header>

      <section className="stats wrap">
        <div className="stats-inner">
          <div className="stat">
            <div className="stat-val">₹499<span style={{ fontSize: '13px' }}>/mo</span></div>
            <div className="stat-label">Starting price, per property</div>
          </div>
          <div className="stat">
            <div className="stat-val">10 min</div>
            <div className="stat-label">To set up your first property</div>
          </div>
          <div className="stat">
            <div className="stat-val">1–2 sec</div>
            <div className="stat-label">Staff permission sync time</div>
          </div>
        </div>
      </section>

      <section className="section wrap">
        <div className="section-head">
          <span className="eyebrow">Why Pavio exists</span>
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

      <section className="section wrap" id="features" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <span className="eyebrow">What's included</span>
          <h2>Everything a small property runs on daily.</h2>
          <p>No hotel-chain features you'll never open — just the tools a hostel or PG actually needs.</p>
        </div>
        <div className="feat-grid">
          <div className="card feat">
            <div className="fic" style={{ background: 'var(--green-bg)', color: 'var(--green)' }}>01</div>
            <h3>Live bed map</h3>
            <p>See every room and bed at a glance — occupied, vacant, or rent overdue — updated in real time.</p>
          </div>
          <div className="card feat">
            <div className="fic" style={{ background: 'var(--red-bg)', color: 'var(--red)' }}>02</div>
            <h3>WhatsApp rent reminders</h3>
            <p>Automated reminders go out on the due date. No manual typing, no missed follow-ups.</p>
          </div>
          <div className="card feat">
            <div className="fic" style={{ background: 'var(--blue-bg)', color: 'var(--blue)' }}>03</div>
            <h3>Staff & permissions</h3>
            <p>Add staff accounts with exactly the access they need — front desk, accounts, or full admin.</p>
          </div>
          <div className="card feat">
            <div className="fic" style={{ background: 'var(--amber-bg)', color: 'var(--amber)' }}>04</div>
            <h3>Multi-property ready</h3>
            <p>Running more than one hostel or PG? Manage every property from a single login.</p>
          </div>
          <div className="card feat">
            <div className="fic" style={{ background: 'var(--green-bg)', color: 'var(--green)' }}>05</div>
            <h3>Mobile-first</h3>
            <p>Built for a phone at the front desk, not a desktop you check once a week.</p>
          </div>
          <div className="card feat">
            <div className="fic" style={{ background: 'var(--blue-bg)', color: 'var(--blue)' }}>06</div>
            <h3>Priced for small properties</h3>
            <p>A fraction of what hotel-chain platforms charge, because that's the budget you're actually working with.</p>
          </div>
        </div>
      </section>

      <section className="section wrap" id="pricing" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <span className="eyebrow">Pricing</span>
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
              <li>Bed map & tenant records</li>
              <li>Manual rent tracking</li>
              <li>Email support</li>
            </ul>
            <a href="/app" className="btn">Sign up</a>
          </div>
          <div className="card price-card">
            <div className="price-top"><span className="price-tier">Basic</span></div>
            <div className="price-amt">₹499<span>/mo</span></div>
            <div className="price-sub">₹3,999/year — save ₹1,989</div>
            <ul className="price-feats">
              <li style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Everything in Trial, plus:</li>
              <li>Tap a button to open WhatsApp, you hit send</li>
              <li>Finance reports — CSV & PDF export</li>
            </ul>
            <a href="/app" className="btn">Choose Basic</a>
          </div>
          <div className="card price-card pop">
            <div className="price-top">
              <span className="price-tier">Pro</span>
              <span className="badge" style={{ background: 'var(--brand-bg)', color: 'var(--brand)' }}>Popular</span>
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
            <a href="/app" className="btn" style={{ background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' }}>Choose Pro</a>
          </div>
        </div>
      </section>

      <section className="wrap" style={{ paddingBottom: '80px' }}>
        <div className="closing">
          <h2>Stop running your hostel from three different apps.</h2>
          <p>Set up your first property in under 10 minutes. No credit card required.</p>
          <a href="#pricing" className="btn btn-primary" style={{ background: '#fff', color: 'var(--text)', borderColor: '#fff' }}>Sign up</a>
        </div>
      </section>

      <footer>
        <div className="wrap foot-inner">
          <span className="logo" style={{ fontSize: '14.5px', color: 'var(--text)' }}>{LOGO} pavio</span>
          <span>&copy; 2026 Pavio</span>
        </div>
      </footer>
    </div>
  )
}
