-- Content managed from FAY OS → Content instead of being written into the website and the app:
-- estate places (Explore and the 360° tour) and legal documents (terms, privacy) with their published versions.

CREATE TABLE IF NOT EXISTS estate_places (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  subtitle VARCHAR(160),
  description TEXT,
  features JSONB NOT NULL DEFAULT '[]',
  glyph VARCHAR(8),
  zone VARCHAR(40) NOT NULL DEFAULT 'amenities',      -- residences, wellness, dining, outdoors, amenities, sport
  cover_url TEXT,                                     -- photo shown in lists
  panorama_url TEXT,                                  -- equirectangular 360° image: the place appears in the virtual tour
  panorama_yaw INTEGER NOT NULL DEFAULT 0,            -- direction the tour opens facing (degrees)
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO estate_places (name, subtitle, glyph, cover_url, description, features, zone, sort_order)
SELECT * FROM (VALUES
  ($t$Wellness Club$t$, $t$Gym & Spa$t$, $t$⚭$t$, '/images/site/gym.jpg', $t$Strength, recovery and training under one roof.$t$, '["Gym", "Spa", "Recovery Suite"]'::jsonb, 'wellness', 0),
  ($t$Pool Club$t$, $t$Cabanas & Sun Deck$t$, $t$≈$t$, '/images/site/sunset.jpg', $t$A tranquil pool set among tropical gardens.$t$, '["Private cabanas", "Poolside service"]'::jsonb, 'outdoors', 10),
  ($t$Dining$t$, $t$Vitality Café · Sky Deck$t$, $t$✦$t$, '/images/site/club-night.jpg', $t$Fresh, healthy, inspired dining across the estate.$t$, '["Vitality Café", "The Sky Deck", "Private Dining"]'::jsonb, 'dining', 20),
  ($t$Villas$t$, $t$Serenity Collection$t$, $t$⌂$t$, '/images/site/spa.jpg', $t$Private residences designed around wellbeing.$t$, '["Serenity Villas 1–8", "Riviera Collection"]'::jsonb, 'residences', 30),
  ($t$Business Lounge$t$, $t$Co-working$t$, $t$▤$t$, '/images/site/explore.jpg', $t$A refined space to work quietly on the estate.$t$, '["Private booths", "Meeting rooms"]'::jsonb, 'amenities', 40)
) AS v(name, subtitle, glyph, cover_url, description, features, zone, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM estate_places);

-- A document's text is edited as a draft and published as a new version; earlier versions are kept, and each
-- booking records the version of the terms the guest accepted.
CREATE TABLE IF NOT EXISTS legal_documents (
  slug VARCHAR(40) PRIMARY KEY,                       -- terms, privacy
  title VARCHAR(160) NOT NULL,
  draft TEXT NOT NULL DEFAULT '',                     -- Markdown being edited
  version INTEGER NOT NULL DEFAULT 0,                 -- latest published version (0 = never published)
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS legal_document_versions (
  slug VARCHAR(40) NOT NULL REFERENCES legal_documents(slug) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  title VARCHAR(160) NOT NULL,
  body TEXT NOT NULL,
  summary VARCHAR(500),                               -- what changed, shown to staff
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  published_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (slug, version)
);

INSERT INTO legal_documents (slug, title, draft, version) VALUES
  ('terms', 'Terms of Service', $md$Welcome to Faysha - Property by Result. These Terms of Service ("Terms") govern your access to and use of our website, services, and apartment rental facilities located in Cameroon. By accessing or using our services, you agree to be bound by these Terms.

Please read these Terms carefully before using our services. If you do not agree with any part of these Terms, you may not access our services.

## 1. Definitions

- **"We," "Us," "Our"** refers to Faysha - Property by Result
- **"You," "Guest," "User"** refers to the individual or entity using our services
- **"Services"** refers to apartment rentals, website access, and related amenities
- **"Property"** refers to our apartment units and facilities
- **"Booking"** refers to a reservation for accommodation

## 2. Eligibility

To use our services, you must:

- Be at least 18 years of age
- Have the legal capacity to enter into binding contracts
- Provide accurate and complete information during registration and booking
- Comply with all applicable laws and regulations

## 3. Booking and Reservations

### 3.1 Making a Booking

- All bookings are subject to availability
- You must provide accurate personal and payment information
- A booking confirmation will be sent to your email upon successful reservation
- You will receive digital access codes via email prior to check-in

### 3.2 Payment

- Payment is required at the time of booking
- We accept payments through Stripe (credit/debit cards)
- All prices are listed in XAF (Central African CFA Franc)
- Prices may vary based on dates, occupancy, and special events
- Additional charges may apply for extra guests or services

### 3.3 Confirmation and Changes

- Booking confirmations are sent via email
- Changes to bookings are subject to availability and may incur fees
- We reserve the right to cancel bookings in case of force majeure or property issues

## 4. Cancellation and Refund Policy

### 4.1 Guest Cancellations

- **More than 14 days before check-in:** Full refund minus processing fees
- **7-14 days before check-in:** 50% refund
- **Less than 7 days before check-in:** No refund
- **No-show:** No refund

### 4.2 Our Cancellations

If we cancel your booking due to circumstances within our control, you will receive:

- Full refund of all payments made
- Assistance in finding alternative accommodation (if available)

## 5. Check-In and Check-Out

- **Check-in time:** 2:00 PM (14:00)
- **Check-out time:** 11:00 AM
- Early check-in or late check-out may be available upon request and may incur additional charges
- You must present valid government-issued identification at check-in
- Digital access codes will be provided via email and SMS
- Late check-out without prior approval may result in additional charges

## 6. Guest Conduct and Responsibilities

### 6.1 General Conduct

Guests agree to:

- Treat the property with respect and care
- Comply with all property rules and regulations
- Not exceed the maximum occupancy limit
- Not disturb other guests or neighbors
- Not engage in illegal activities on the premises
- Not smoke in non-designated areas
- Not bring pets without prior written approval

### 6.2 Damages and Losses

- You are responsible for any damage to the property caused by you or your guests
- Report any damages or issues immediately to our staff
- We may charge your payment method for repair or replacement costs
- Lost key cards or access devices may incur replacement fees

## 7. Property Access and Amenities

- Access to amenities (pool, gym, etc.) is included with your stay
- Amenities may have specific operating hours
- We reserve the right to close amenities for maintenance or safety reasons
- Use of amenities is at your own risk
- Children must be supervised by adults at all times in common areas

## 8. Internet and Technology Services

- WiFi and Smart TV services are provided as amenities
- We do not guarantee uninterrupted internet service
- Use of our network must comply with applicable laws
- Illegal downloading or streaming is prohibited
- We are not liable for any security breaches on our network

## 9. Safety and Security

- We employ smart access systems for your security
- Do not share access codes with unauthorized persons
- Report any security concerns immediately
- We are not responsible for personal belongings left in the apartment
- In case of emergency, contact local emergency services and our staff

## 10. Privacy and Data Protection

Your use of our services is also governed by our Privacy Policy. Please review our [Privacy Policy](/privacy) to understand how we collect, use, and protect your personal information.

## 11. Limitation of Liability

To the fullest extent permitted by law:

- We are not liable for any indirect, incidental, special, or consequential damages
- Our total liability shall not exceed the amount paid for your booking
- We are not responsible for delays or failures due to circumstances beyond our control
- We are not liable for personal injury or property damage except where caused by our negligence

## 12. Force Majeure

We are not liable for any failure to perform our obligations due to circumstances beyond our reasonable control, including but not limited to: natural disasters, war, terrorism, riots, civil unrest, government actions, pandemics, or utility failures.

## 13. Intellectual Property

All content on our website, including text, graphics, logos, images, and software, is our property or our licensors' property and is protected by copyright and trademark laws. You may not:

- Reproduce, distribute, or modify our content without permission
- Use our trademarks or branding without authorization
- Create derivative works based on our content

## 14. Governing Law and Dispute Resolution

These Terms are governed by the laws of Cameroon. Any disputes arising from these Terms or your use of our services shall be resolved through:

1. Good faith negotiation between the parties
2. If unresolved, mediation in Cameroon
3. If mediation fails, litigation in the courts of Cameroon

## 15. Modifications to Terms

We reserve the right to modify these Terms at any time. We will notify you of material changes by posting the updated Terms on our website and updating the "Last updated" date. Your continued use of our services after such changes constitutes acceptance of the modified Terms.

## 16. Severability

If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.

## 17. Entire Agreement

These Terms, together with our Privacy Policy and any other policies referenced herein, constitute the entire agreement between you and us regarding the use of our services.

## 18. Contact Information

If you have any questions about these Terms of Service, please contact us:

**Faysha - Property by Result**

Email: [info@fayshaa.com](mailto:info@fayshaa.com)

Website: [www.fayshaa.com](https://www.fayshaa.com)

Location: Cameroon

By using our website and services, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.$md$, 1),
  ('privacy', 'Privacy Policy', $md$At Faysha - Property by Result ("we," "our," or "us"), we are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website [www.fayshaa.com](https://www.fayshaa.com) and use our services.

Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access the site or use our services.

## 1. Information We Collect

### 1.1 Personal Information

We may collect personal information that you voluntarily provide to us when you:

- Make a booking or reservation
- Create an account
- Contact us with inquiries
- Subscribe to our newsletter
- Apply for a job
- Provide feedback

This information may include:

- Full name
- Email address
- Phone number
- Mailing address
- Payment information (processed securely through Stripe)
- Government-issued ID (for booking verification)
- Employment history and qualifications (for job applications)

### 1.2 Automatically Collected Information

When you visit our website, we automatically collect certain information about your device, including:

- IP address
- Browser type and version
- Device type and operating system
- Referring website
- Pages visited and time spent on pages
- Date and time of visits

## 2. How We Use Your Information

We use the information we collect for the following purposes:

- To process and manage your bookings and reservations
- To communicate with you about your bookings, including sending confirmations and digital access codes
- To process payments securely
- To respond to your inquiries and provide customer support
- To send you marketing communications (with your consent)
- To improve our website and services
- To analyze usage patterns and optimize user experience
- To process job applications
- To comply with legal obligations
- To prevent fraud and enhance security

## 3. Information Sharing and Disclosure

We do not sell, trade, or rent your personal information to third parties. We may share your information in the following circumstances:

### 3.1 Service Providers

We may share your information with third-party service providers who assist us in operating our website and providing our services, including:

- Payment processors (Stripe)
- Email service providers
- Cloud hosting services
- Analytics providers

### 3.2 Legal Requirements

We may disclose your information if required to do so by law or in response to valid requests by public authorities (e.g., court orders, government agencies).

## 4. Data Security

We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. These measures include:

- SSL/TLS encryption for data transmission
- Secure payment processing through PCI-compliant providers
- Regular security assessments and updates
- Access controls and authentication
- Employee training on data protection

However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your personal information, we cannot guarantee absolute security.

## 5. Your Privacy Rights

You have the following rights regarding your personal information:

- **Access:** Request copies of your personal information
- **Correction:** Request correction of inaccurate or incomplete information
- **Deletion:** Request deletion of your personal information
- **Objection:** Object to our processing of your personal information
- **Restriction:** Request restriction of processing of your personal information
- **Data Portability:** Request transfer of your information to another service
- **Withdraw Consent:** Withdraw your consent at any time

To exercise any of these rights, please contact us at [info@fayshaa.com](mailto:info@fayshaa.com).

## 6. Cookies and Tracking Technologies

We use cookies and similar tracking technologies to track activity on our website and store certain information. Cookies are files with small amounts of data that are sent to your browser from a website and stored on your device.

You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, you may not be able to use some portions of our website.

## 7. Third-Party Links

Our website may contain links to third-party websites. We are not responsible for the privacy practices or content of these third-party sites. We encourage you to read the privacy policies of any third-party sites you visit.

## 8. Children's Privacy

Our services are not directed to individuals under the age of 18. We do not knowingly collect personal information from children. If you are a parent or guardian and believe your child has provided us with personal information, please contact us, and we will take steps to delete such information.

## 9. International Data Transfers

Your information may be transferred to and maintained on computers located outside of Cameroon, where data protection laws may differ. By using our services, you consent to the transfer of your information to our facilities and service providers.

## 10. Data Retention

We retain your personal information only for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required or permitted by law. When we no longer need your information, we will securely delete or anonymize it.

## 11. Push Notifications

We may send you push notifications regarding your bookings, special offers, and important updates. You can opt-out of receiving push notifications by adjusting your device settings or through the notification preferences in your account.

## 12. Changes to This Privacy Policy

We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements. We will notify you of any material changes by posting the new Privacy Policy on this page and updating the "Last updated" date. We encourage you to review this Privacy Policy periodically.

## 13. Contact Us

If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:

**Faysha - Property by Result**

Email: [info@fayshaa.com](mailto:info@fayshaa.com)

Website: [www.fayshaa.com](https://www.fayshaa.com)

Location: Cameroon

By using our website and services, you acknowledge that you have read and understood this Privacy Policy and agree to its terms.$md$, 1)
ON CONFLICT (slug) DO NOTHING;
INSERT INTO legal_document_versions (slug, version, title, body, summary, effective_date)
SELECT slug, 1, title, draft, 'Carried over from the website', DATE '2026-04-30' FROM legal_documents
 WHERE slug IN ('terms', 'privacy')
ON CONFLICT DO NOTHING;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS terms_version INTEGER;
