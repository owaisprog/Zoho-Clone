import Link from "next/link";
import { ArrowRight, CheckCircle2, Layers3, ShieldAlert } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="landing">
      <header className="landing-top">
        <div className="landing-brand">
          Workspace OS
          <small>ORIGINAL INTERNAL CONCEPT</small>
        </div>
        <Link className="btn" href="/app">Open demo workspace <ArrowRight size={15} aria-hidden="true" /></Link>
      </header>
      <main className="landing-content">
        <div>
          <p className="eyebrow">P3.01 / ACTUAL FRONTEND SCAFFOLD</p>
          <h1>A clearer workspace for the teams behind the operation.</h1>
          <p>
            An original, evolving business workspace for sales and internal merchant
            operations. This first preview uses fictional data and is not a real
            merchant account, processor integration, or production service.
          </p>
          <Link className="btn btn-primary" href="/app">
            Explore synthetic demo <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <div className="landing-meta">
            <span><CheckCircle2 size={13} style={{ display: "inline", marginRight: 5 }} aria-hidden="true" />Next.js + TypeScript source</span>
            <span><Layers3 size={13} style={{ display: "inline", marginRight: 5 }} aria-hidden="true" />Original design tokens</span>
            <span><ShieldAlert size={13} style={{ display: "inline", marginRight: 5 }} aria-hidden="true" />No sensitive data or login</span>
          </div>
        </div>
        <section className="landing-preview" aria-label="Illustrative application summary">
          <div className="preview-head"><strong>Orchid Payments Demo</strong><span>Internal queue · fictional</span></div>
          <div className="preview-cells">
            <div className="preview-cell"><strong>Demo River Retail</strong><span className="status-pill stage-draft">Draft</span></div>
            <div className="preview-cell"><strong>Demo Pine Market</strong><span className="status-pill stage-needs_more_info">Needs information</span></div>
            <div className="preview-cell"><strong>Demo Cedar Books</strong><span className="status-pill stage-waiting_demo">Waiting (demo)</span></div>
            <div className="preview-cell"><strong>Demo Lantern Cafe</strong><span className="status-pill stage-active_internal">Active internally</span></div>
          </div>
          <div className="preview-foot">Illustrative internal workflow. No underwriting or payment processing.</div>
        </section>
      </main>
    </div>
  );
}
