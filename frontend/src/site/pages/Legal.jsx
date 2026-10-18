import PrivacyBody from '../legal/PrivacyBody';
import TermsBody, { LAST_UPDATED } from '../legal/TermsBody';

function LegalPage({ kicker, title, children }) {
  return (
    <>
      <section className="fs-container fs-container--narrow fs-page-head" style={{ paddingBottom: 40 }}>
        <p className="fs-kicker">{kicker}</p>
        <h1 className="fs-h1">{title}</h1>
        <p className="fs-muted" style={{ marginTop: 16, fontSize: 14 }}>
          Last updated: {LAST_UPDATED}
        </p>
      </section>
      <section className="fs-container fs-container--narrow" style={{ paddingBottom: 120 }}>
        <article className="fs-card fs-prose" style={{ padding: 'clamp(24px, 5vw, 56px)' }}>
          {children}
        </article>
      </section>
    </>
  );
}

export function Terms() {
  return (
    <LegalPage kicker="Terms of stay" title="Terms of Service">
      <TermsBody />
    </LegalPage>
  );
}

export function Privacy() {
  return (
    <LegalPage kicker="Your data" title="Privacy Policy">
      <PrivacyBody />
    </LegalPage>
  );
}
