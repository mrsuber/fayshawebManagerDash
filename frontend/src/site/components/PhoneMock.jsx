import { MOODS } from '../data';

/**
 * The guest app's home screen, drawn in the app's own theme (mobile/src/constants/theme.js) so the site
 * shows exactly what guests get: greeting + AI button, the four moods, quick access, the AI companion
 * card and the five tabs (mobile/src/screens/wellness/HomeScreen.jsx, navigation/AppNavigator.jsx).
 */
export default function PhoneMock() {
  return (
    <div className="fs-phone" role="img" aria-label="The Faysha app home screen: greeting, four moods, quick access to the digital key, bookings and concierge, and the AI companion.">
      <div className="fs-phone__screen" aria-hidden="true">
        <div className="fs-phone__notch" />
        <div className="fs-phone__content">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: 1, color: 'rgba(242,233,216,.5)' }}>GOOD EVENING</div>
              <div className="fs-phone__name">Amara</div>
            </div>
            <div className="fs-phone__ai">
              <span>AI</span>
              <span className="fs-phone__badge">2</span>
            </div>
          </div>
          <div style={{ fontSize: 14, marginBottom: 14 }}>How would you like to feel today?</div>
          <div className="fs-phone__moods">
            {MOODS.map((m) => (
              <div key={m.id} className="fs-phone__mood">
                <img src={m.img} alt="" loading="lazy" />
                <span>{m.name}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(242,233,216,.5)', marginBottom: 10 }}>QUICK ACCESS</div>
          <div className="fs-phone__quick">
            <div>
              <i>
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <circle cx="8" cy="12" r="4" fill="none" stroke="#C8A45D" strokeWidth="1.8" />
                  <path d="M12 12h9M18 12v3M21 12v2" fill="none" stroke="#C8A45D" strokeWidth="1.8" />
                </svg>
              </i>
              Digital Key
            </div>
            <div>
              <i>
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <rect x="4" y="5" width="16" height="15" rx="2" fill="none" stroke="#C8A45D" strokeWidth="1.8" />
                  <path d="M4 10h16M9 3v4M15 3v4" fill="none" stroke="#C8A45D" strokeWidth="1.8" />
                </svg>
              </i>
              Bookings
            </div>
            <div>
              <i>✦</i>
              Concierge
            </div>
          </div>
          <div className="fs-phone__companion">
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
              <span
                style={{
                  width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg,#C8A45D,#D68910)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0D0D0D', fontSize: 12,
                }}
              >
                ✦
              </span>
              <span style={{ fontSize: 9.5, letterSpacing: 2, fontWeight: 700, color: '#C8A45D' }}>FAYSHA AI COMPANION</span>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.45, marginBottom: 10 }}>
              Your sunset ceremony begins in 30 minutes — shall I reserve your seat?
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#C8A45D' }}>Tap to respond →</div>
          </div>
        </div>
        <div className="fs-phone__tabs">
          {[
            ['Home', 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z', true],
            ['Wellness', 'M12 20c-4-2-7-5-7-9 2 0 5 1 7 4 2-3 5-4 7-4 0 4-3 7-7 9zM12 15c-1-3-1-6 0-10 1 4 1 7 0 10z'],
            ['Explore', 'M15.5 8.5l-2 5-5 2 2-5zM12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z'],
            ['Concierge', 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0'],
            ['Profile', 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21c1-4 4-6 8-6s7 2 8 6'],
          ].map(([label, d, on]) => (
            <span key={label} className={on ? 'on' : undefined}>
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path d={d} fill={on ? '#C8A45D' : 'none'} stroke="currentColor" strokeWidth={on ? 0 : 1.5} />
              </svg>
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
