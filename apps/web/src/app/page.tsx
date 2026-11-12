import { ApiStatus } from '../components/api-status';

const plannedModules = [
  {
    number: '01',
    name: 'Organizations & access',
    detail: 'Tenant isolation, users, membership and role-based permissions.',
    stage: 'Next'
  },
  {
    number: '02',
    name: 'CRM workspace',
    detail: 'Accounts, contacts, opportunities and activity timelines.',
    stage: 'Planned'
  },
  {
    number: '03',
    name: 'Merchant onboarding',
    detail: 'Checklists, ownership, review stages and status history.',
    stage: 'Planned'
  }
];

const steps = [
  'Validate the buyer and the first high-priority workflow.',
  'Approve requirements and tenancy/security boundaries.',
  'Implement tested modules in small reviewable changes.'
];

export default function Home() {
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Workspace navigation">
        <div className="brand">
          <div className="brand-symbol" aria-hidden="true">B</div>
          <div>
            <div className="brand-name">Business OS</div>
            <div className="brand-meta">FOUNDATION PREVIEW</div>
          </div>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Application modules">
          <div className="nav-entry nav-entry--active" aria-current="page">
            <span className="nav-glyph" aria-hidden="true">◫</span> Overview
          </div>
          <div className="nav-entry nav-entry--pending"><span className="nav-glyph" aria-hidden="true">▧</span> CRM <span className="soon">Soon</span></div>
          <div className="nav-entry nav-entry--pending"><span className="nav-glyph" aria-hidden="true">⇄</span> Onboarding <span className="soon">Soon</span></div>
          <div className="nav-entry nav-entry--pending"><span className="nav-glyph" aria-hidden="true">▤</span> Reports <span className="soon">Soon</span></div>
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-caption">Prototype environment</div>
          <div>Not connected to production data</div>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <span className="breadcrumbs">Workspace <span>/</span> Overview</span>
          <span className="environment-label">DEVELOPMENT</span>
        </header>

        <main className="main-content">
          <div className="page-intro">
            <div>
              <p className="eyebrow">PROJECT STATUS / PHASE 0</p>
              <h1>Build the foundation. Then scale.</h1>
              <p className="page-subtitle">
                A modular operating system is taking shape. This preview shows the application shell,
                not a completed CRM or a working customer database.
              </p>
            </div>
            <ApiStatus />
          </div>

          <section className="overview-grid" aria-label="Current development state">
            <article className="metric-card">
              <span className="metric-label">Active business modules</span>
              <strong className="metric-value">0</strong>
              <span className="metric-note">Platform foundation only</span>
            </article>
            <article className="metric-card">
              <span className="metric-label">Customer records</span>
              <strong className="metric-value">0</strong>
              <span className="metric-note">No database connected</span>
            </article>
            <article className="metric-card">
              <span className="metric-label">Current development gate</span>
              <strong className="metric-value metric-value--text">P0</strong>
              <span className="metric-note">Customer validation pending</span>
            </article>
          </section>

          <div className="content-grid">
            <section className="panel panel--modules" aria-labelledby="planned-heading">
              <div className="panel-header">
                <div>
                  <p className="panel-eyebrow">PLATFORM ROADMAP</p>
                  <h2 id="planned-heading">Planned first modules</h2>
                </div>
                <span className="tag">Draft scope</span>
              </div>
              <div className="module-list">
                {plannedModules.map((module) => (
                  <article className="module-row" key={module.number}>
                    <span className="module-number">{module.number}</span>
                    <div className="module-copy">
                      <h3>{module.name}</h3>
                      <p>{module.detail}</p>
                    </div>
                    <span className="module-stage">{module.stage}</span>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel" aria-labelledby="next-heading">
              <div className="panel-header">
                <div>
                  <p className="panel-eyebrow">DELIVERY PROCESS</p>
                  <h2 id="next-heading">What comes next</h2>
                </div>
              </div>
              <ol className="step-list">
                {steps.map((step, index) => (
                  <li key={step}>
                    <span className="step-index">{index + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              <div className="info-note">
                Every feature will pass review, testing, and security checks before production use.
              </div>
            </section>
          </div>

          <footer className="footer-line">
            <span>Business OS · Technical spike v0.1</span>
            <span>Illustrative interface · No live customer data</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
