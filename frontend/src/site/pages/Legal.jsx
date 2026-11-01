import Markdown from '../../components/Markdown';
import { Loading } from '../components/ui';
import PrivacyBody from '../legal/PrivacyBody';
import TermsBody, { LAST_UPDATED } from '../legal/TermsBody';
import useLegal from '../legal/useLegal';

const longDate = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Terms and privacy as published in FAY OS → Content (the text bundled with the site is the fallback). */
function LegalPage({ slug, kicker, fallbackTitle, Fallback }) {
  const doc = useLegal(slug);
  if (doc === undefined) return <Loading label="Loading" />;
  return (
    <>
      <section className="fs-container fs-container--narrow fs-page-head" style={{ paddingBottom: 40 }}>
        <p className="fs-kicker">{kicker}</p>
        <h1 className="fs-h1">{doc?.title || fallbackTitle}</h1>
        <p className="fs-muted" style={{ marginTop: 16, fontSize: 14 }}>
          {doc ? `Version ${doc.version} · in effect from ${longDate(doc.effectiveDate)}` : `Last updated: ${LAST_UPDATED}`}
        </p>
      </section>
      <section className="fs-container fs-container--narrow" style={{ paddingBottom: 120 }}>
        <article className="fs-card fs-prose" style={{ padding: 'clamp(24px, 5vw, 56px)' }}>
          {doc ? <Markdown source={doc.body} /> : <Fallback />}
        </article>
      </section>
    </>
  );
}

export function Terms() {
  return <LegalPage slug="terms" kicker="Terms of stay" fallbackTitle="Terms of Service" Fallback={TermsBody} />;
}

export function Privacy() {
  return <LegalPage slug="privacy" kicker="Your data" fallbackTitle="Privacy Policy" Fallback={PrivacyBody} />;
}
