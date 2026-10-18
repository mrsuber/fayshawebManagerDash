import { Link } from 'react-router-dom';
import { CONTACT, IMG, tel } from '../data';
import { useLang } from '../i18n';

export default function Footer() {
  const { t } = useLang();
  return (
    <footer className="fs-footer" id="contact-footer">
      <div className="fs-container">
        <div className="fs-footer__grid">
          <div className="fs-footer__col">
            <img src={IMG.logo} alt="Faysha Wellness Residence — One destination, endless serenity" width="150" height="150" style={{ objectFit: 'contain' }} />
          </div>
          <div className="fs-footer__col">
            <span className="fs-footer__head">{t('footer.stay')}</span>
            <Link to="/residences">{t('nav.residences')}</Link>
            <Link to="/wellness">{t('nav.wellness')}</Link>
            <Link to="/#dining">{t('nav.dining')}</Link>
            <Link to="/#app">{t('nav.app')}</Link>
          </div>
          <div className="fs-footer__col">
            <span className="fs-footer__head">{t('footer.faysha')}</span>
            <Link to="/about">{t('nav.about')}</Link>
            <Link to="/careers">{t('nav.careers')}</Link>
            <Link to="/feedback">{t('nav.feedback')}</Link>
            <Link to="/contact">{t('nav.contact')}</Link>
          </div>
          <div className="fs-footer__col">
            <span className="fs-footer__head">{t('footer.visit')}</span>
            <span>{CONTACT.location}</span>
            <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
            <a href={tel(CONTACT.concierge)}>Concierge · {CONTACT.concierge}</a>
            <a href={tel(CONTACT.emergency)}>Emergency · {CONTACT.emergency}</a>
          </div>
        </div>
        <div className="fs-footer__base">
          <span>
            © {new Date().getFullYear()} {t('footer.rights')}
          </span>
          <span style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <Link to="/privacy">{t('footer.privacy')}</Link>
            <Link to="/terms">{t('footer.terms')}</Link>
            <Link to="/login">{t('footer.staff')}</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
