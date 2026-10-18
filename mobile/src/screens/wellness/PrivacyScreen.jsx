import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '../../constants/theme';

export default function PrivacyScreen() {
  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <LinearGradient
          colors={['rgba(200, 164, 93, 0.15)', 'rgba(200, 164, 93, 0.05)', COLORS.background]}
          style={styles.header}
        >
          <Text style={styles.headerTitle}>Privacy Policy</Text>
          <Text style={styles.headerSubtitle}>Fayshaa Wellness Residence</Text>
          <Text style={styles.lastUpdated}>Last Updated: {new Date().toLocaleDateString()}</Text>
        </LinearGradient>

        {/* Introduction */}
        <View style={styles.section}>
          <Text style={styles.introText}>
            Fayshaa Wellness Residence ("we," "us," or "our") is committed to protecting your privacy.
            This Privacy Policy explains how we collect, use, disclose, and safeguard your information
            when you visit our estate, use our mobile application, or book our services.
          </Text>
        </View>

        {/* 1. Information We Collect */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. INFORMATION WE COLLECT</Text>

          <Text style={styles.subsectionTitle}>1.1 Personal Information</Text>
          <Text style={styles.bodyText}>
            We collect information that you provide directly to us, including:
            {'\n'}• Full name and contact details (email, phone number, address)
            {'\n'}• Government-issued ID information (passport, national ID)
            {'\n'}• Payment information (credit card details, billing address)
            {'\n'}• Date of birth and nationality
            {'\n'}• Emergency contact information
            {'\n'}• Dietary preferences and allergies
            {'\n'}• Health information relevant to wellness services
            {'\n'}• Communication preferences
          </Text>

          <Text style={styles.subsectionTitle}>1.2 Booking Information</Text>
          <Text style={styles.bodyText}>
            When you make a reservation, we collect:
            {'\n'}• Check-in and check-out dates
            {'\n'}• Room/villa preferences
            {'\n'}• Special requests and accessibility needs
            {'\n'}• Guest count and composition
            {'\n'}• Service bookings (spa, dining, activities)
          </Text>

          <Text style={styles.subsectionTitle}>1.3 Automatically Collected Information</Text>
          <Text style={styles.bodyText}>
            Our mobile app and website automatically collect:
            {'\n'}• Device information (model, operating system, unique identifiers)
            {'\n'}• IP address and location data
            {'\n'}• App usage data and analytics
            {'\n'}• Digital key access logs
            {'\n'}• WiFi connection data
            {'\n'}• Crash reports and performance data
          </Text>

          <Text style={styles.subsectionTitle}>1.4 Estate Activity Information</Text>
          <Text style={styles.bodyText}>
            During your stay, we may collect:
            {'\n'}• Access logs (digital key, gate entry, facilities)
            {'\n'}• Service usage (gym, spa, pool, dining)
            {'\n'}• Concierge chat messages and requests
            {'\n'}• Wellness activity participation
            {'\n'}• Feedback and reviews
          </Text>
        </View>

        {/* 2. How We Use Your Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. HOW WE USE YOUR INFORMATION</Text>
          <Text style={styles.bodyText}>
            We use the information we collect to:
            {'\n'}• Process and manage your bookings and reservations
            {'\n'}• Provide personalized wellness services and recommendations
            {'\n'}• Grant digital access to facilities (digital keys, QR codes)
            {'\n'}• Communicate about your stay, services, and updates
            {'\n'}• Process payments and send invoices
            {'\n'}• Respond to concierge requests and customer support inquiries
            {'\n'}• Improve our services, facilities, and mobile app
            {'\n'}• Ensure safety and security of guests and property
            {'\n'}• Comply with legal obligations and resolve disputes
            {'\n'}• Send marketing communications (with your consent)
            {'\n'}• Analyze usage patterns to enhance guest experience
          </Text>
        </View>

        {/* 3. Information Sharing */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. INFORMATION SHARING & DISCLOSURE</Text>

          <Text style={styles.subsectionTitle}>3.1 Service Providers</Text>
          <Text style={styles.bodyText}>
            We share information with trusted third-party service providers who assist us with:
            {'\n'}• Payment processing (secure payment gateways)
            {'\n'}• Cloud hosting and data storage
            {'\n'}• Email and SMS communication services
            {'\n'}• Analytics and app performance monitoring
            {'\n'}• Customer relationship management (CRM)
            {'\n\n'}
            These providers are contractually obligated to protect your data and use it only for
            specified purposes.
          </Text>

          <Text style={styles.subsectionTitle}>3.2 Legal Requirements</Text>
          <Text style={styles.bodyText}>
            We may disclose your information when required by law or to:
            {'\n'}• Comply with legal processes or government requests
            {'\n'}• Enforce our Terms & Conditions
            {'\n'}• Protect the rights, property, or safety of Fayshaa, guests, or others
            {'\n'}• Prevent fraud or security threats
          </Text>

          <Text style={styles.subsectionTitle}>3.3 Business Transfers</Text>
          <Text style={styles.bodyText}>
            In the event of a merger, acquisition, or sale of assets, your information may be
            transferred to the acquiring entity, subject to this Privacy Policy.
          </Text>

          <Text style={styles.subsectionTitle}>3.4 What We Don't Share</Text>
          <Text style={styles.bodyText}>
            We do <Text style={styles.bold}>NOT</Text> sell, rent, or trade your personal
            information to third parties for their marketing purposes.
          </Text>
        </View>

        {/* 4. Data Security */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. DATA SECURITY</Text>
          <Text style={styles.bodyText}>
            We implement industry-standard security measures to protect your information:
            {'\n'}• Encryption of sensitive data (SSL/TLS protocols)
            {'\n'}• Secure payment processing (PCI DSS compliant)
            {'\n'}• Regular security audits and vulnerability assessments
            {'\n'}• Access controls and authentication requirements
            {'\n'}• Secure cloud infrastructure with backup systems
            {'\n'}• Employee training on data protection
            {'\n\n'}
            However, no method of transmission over the internet is 100% secure. While we strive
            to protect your information, we cannot guarantee absolute security.
          </Text>
        </View>

        {/* 5. Data Retention */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. DATA RETENTION</Text>
          <Text style={styles.bodyText}>
            We retain your personal information for as long as necessary to:
            {'\n'}• Fulfill the purposes outlined in this Privacy Policy
            {'\n'}• Comply with legal, accounting, or reporting requirements
            {'\n'}• Resolve disputes and enforce agreements
            {'\n\n'}
            <Text style={styles.bold}>Retention Periods:</Text>
            {'\n'}• Booking records: 7 years (tax/legal requirements)
            {'\n'}• Payment information: Per payment processor policies
            {'\n'}• Marketing data: Until you opt out or request deletion
            {'\n'}• App usage data: 24 months
            {'\n'}• Security logs: 12 months
          </Text>
        </View>

        {/* 6. Your Privacy Rights */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. YOUR PRIVACY RIGHTS</Text>
          <Text style={styles.bodyText}>
            You have the right to:
            {'\n'}• <Text style={styles.bold}>Access:</Text> Request a copy of your personal data
            {'\n'}• <Text style={styles.bold}>Correction:</Text> Update or correct inaccurate information
            {'\n'}• <Text style={styles.bold}>Deletion:</Text> Request deletion of your data (subject to legal obligations)
            {'\n'}• <Text style={styles.bold}>Opt-Out:</Text> Unsubscribe from marketing communications
            {'\n'}• <Text style={styles.bold}>Data Portability:</Text> Receive your data in a structured format
            {'\n'}• <Text style={styles.bold}>Object:</Text> Object to certain data processing activities
            {'\n'}• <Text style={styles.bold}>Withdraw Consent:</Text> Revoke consent for data processing
            {'\n\n'}
            To exercise these rights, contact us at privacy@fayshaa.com or +237 651 841 003.
          </Text>
        </View>

        {/* 7. Children's Privacy */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. CHILDREN'S PRIVACY</Text>
          <Text style={styles.bodyText}>
            Our services are not directed to children under 13. We do not knowingly collect
            personal information from children under 13 without parental consent. If you believe
            we have inadvertently collected such information, please contact us immediately for
            deletion.
          </Text>
        </View>

        {/* 8. Cookies & Tracking */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. COOKIES & TRACKING TECHNOLOGIES</Text>
          <Text style={styles.bodyText}>
            Our mobile app and website use cookies and similar technologies to:
            {'\n'}• Remember your preferences and settings
            {'\n'}• Analyze app performance and user behavior
            {'\n'}• Provide personalized content and recommendations
            {'\n'}• Measure marketing campaign effectiveness
            {'\n\n'}
            You can control cookie preferences through your device settings, though disabling
            cookies may limit app functionality.
          </Text>
        </View>

        {/* 9. Third-Party Links */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. THIRD-PARTY LINKS & SERVICES</Text>
          <Text style={styles.bodyText}>
            Our app may contain links to third-party websites or services (e.g., booking partners,
            local tour operators). We are not responsible for the privacy practices of these
            third parties. Please review their privacy policies before providing information.
          </Text>
        </View>

        {/* 10. International Data Transfers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. INTERNATIONAL DATA TRANSFERS</Text>
          <Text style={styles.bodyText}>
            Your information may be transferred to and processed in countries outside Cameroon,
            including cloud servers in other jurisdictions. We ensure appropriate safeguards are
            in place to protect your data in compliance with applicable laws.
          </Text>
        </View>

        {/* 11. Marketing Communications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>11. MARKETING COMMUNICATIONS</Text>
          <Text style={styles.bodyText}>
            With your consent, we may send you:
            {'\n'}• Promotional offers and special packages
            {'\n'}• Wellness program updates
            {'\n'}• Event invitations
            {'\n'}• Newsletter and wellness tips
            {'\n\n'}
            You can opt out anytime by:
            {'\n'}• Clicking "unsubscribe" in emails
            {'\n'}• Updating preferences in the mobile app
            {'\n'}• Contacting us at info@fayshaa.com
          </Text>
        </View>

        {/* 12. CCTV & Security Monitoring */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>12. CCTV & SECURITY MONITORING</Text>
          <Text style={styles.bodyText}>
            For safety and security, we operate CCTV cameras in public areas of the estate
            (entrances, parking, pool areas, corridors). Footage is retained for 30 days and
            accessed only for security purposes or legal investigations. Private accommodations
            are not monitored.
          </Text>
        </View>

        {/* 13. Updates to Privacy Policy */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>13. UPDATES TO THIS PRIVACY POLICY</Text>
          <Text style={styles.bodyText}>
            We may update this Privacy Policy periodically to reflect changes in our practices
            or legal requirements. Significant changes will be communicated via email or app
            notification. Continued use of services after updates constitutes acceptance of the
            revised policy.
          </Text>
        </View>

        {/* 14. Contact Us */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>14. CONTACT US</Text>
          <Text style={styles.bodyText}>
            For questions, concerns, or requests regarding this Privacy Policy or your data:
            {'\n\n'}
            <Text style={styles.bold}>Fayshaa Wellness Residence</Text>
            {'\n'}Privacy Officer
            {'\n'}Email: privacy@fayshaa.com
            {'\n'}Phone: +237 651 841 003
            {'\n'}Emergency: +237 653 255 547
            {'\n'}Website: www.fayshaa.com
            {'\n\n'}
            We will respond to all requests within 30 days.
          </Text>
        </View>

        {/* Acceptance Footer */}
        <LinearGradient
          colors={['rgba(200, 164, 93, 0.12)', 'rgba(200, 164, 93, 0.05)']}
          style={styles.acceptanceCard}
        >
          <Text style={styles.acceptanceText}>
            By using Fayshaa services, you acknowledge that you have read and understand this
            Privacy Policy and consent to the collection and use of your information as described.
          </Text>
        </LinearGradient>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderGold,
  },
  headerTitle: {
    fontFamily: FONTS.heading,
    fontSize: 24,
    color: COLORS.text,
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  lastUpdated: {
    fontSize: 11,
    color: COLORS.textTertiary,
  },
  section: {
    paddingHorizontal: 22,
    marginTop: 24,
  },
  introText: {
    fontSize: 13.5,
    lineHeight: 21,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: 12,
    letterSpacing: 1.5,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 12,
  },
  subsectionTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 12,
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  bold: {
    fontWeight: '700',
    color: COLORS.text,
  },
  acceptanceCard: {
    marginHorizontal: 22,
    marginTop: 32,
    borderWidth: 1.5,
    borderColor: 'rgba(200, 164, 93, 0.4)',
    borderRadius: 12,
    padding: 20,
  },
  acceptanceText: {
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.text,
    textAlign: 'center',
    fontWeight: '600',
  },
  bottomSpacing: {
    height: 20,
  },
});
