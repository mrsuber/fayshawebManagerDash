import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '../../constants/theme';

export default function TermsScreen() {
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
          <Text style={styles.headerTitle}>Terms & Conditions</Text>
          <Text style={styles.headerSubtitle}>Fayshaa Wellness Residence</Text>
          <Text style={styles.lastUpdated}>Last Updated: {new Date().toLocaleDateString()}</Text>
        </LinearGradient>

        {/* Introduction */}
        <View style={styles.section}>
          <Text style={styles.introText}>
            Welcome to Fayshaa Wellness Residence. By accessing our estate, booking accommodations,
            or using any of our services, you agree to comply with and be bound by the following
            terms and conditions. Please read them carefully.
          </Text>
        </View>

        {/* 1. Acceptance of Terms */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. ACCEPTANCE OF TERMS</Text>
          <Text style={styles.bodyText}>
            By making a reservation, checking in, or using any Fayshaa services, you acknowledge
            that you have read, understood, and agree to be bound by these Terms & Conditions,
            our Privacy Policy, and all applicable house rules.
          </Text>
        </View>

        {/* 2. Booking & Payment */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. BOOKING & PAYMENT</Text>
          <Text style={styles.bodyText}>
            <Text style={styles.bold}>2.1 Reservations: </Text>
            All bookings must be made through our official website (fayshaa.com), mobile app,
            or authorized booking partners. Reservations are confirmed only upon receipt of full
            payment or required deposit.
          </Text>
          <Text style={styles.bodyText}>
            <Text style={styles.bold}>2.2 Payment Terms: </Text>
            Full payment is due at the time of booking unless otherwise specified. We accept
            major credit cards, bank transfers, and mobile money payments.
          </Text>
          <Text style={styles.bodyText}>
            <Text style={styles.bold}>2.3 Pricing: </Text>
            All prices are in XAF (Central African Franc) unless stated otherwise. Rates are
            subject to change without notice for future bookings.
          </Text>
        </View>

        {/* 3. Cancellation & Refund Policy */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. CANCELLATION & REFUND POLICY</Text>
          <Text style={styles.bodyText}>
            <Text style={styles.bold}>3.1 Standard Cancellation: </Text>
            Cancellations made 14+ days before check-in receive 90% refund. Cancellations made
            7-13 days before check-in receive 50% refund. Cancellations made less than 7 days
            before check-in are non-refundable.
          </Text>
          <Text style={styles.bodyText}>
            <Text style={styles.bold}>3.2 No-Show Policy: </Text>
            Failure to check in without prior cancellation results in full charge with no refund.
          </Text>
          <Text style={styles.bodyText}>
            <Text style={styles.bold}>3.3 Early Departure: </Text>
            Early check-out does not entitle guests to any refund for unused nights.
          </Text>
        </View>

        {/* 4. Check-In & Check-Out */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. CHECK-IN & CHECK-OUT</Text>
          <Text style={styles.bodyText}>
            <Text style={styles.bold}>4.1 Check-In Time: </Text>
            Standard check-in is 3:00 PM. Early check-in subject to availability (additional charges may apply).
          </Text>
          <Text style={styles.bodyText}>
            <Text style={styles.bold}>4.2 Check-Out Time: </Text>
            Check-out is 11:00 AM. Late check-out subject to availability and additional fees.
          </Text>
          <Text style={styles.bodyText}>
            <Text style={styles.bold}>4.3 Identification: </Text>
            Valid government-issued photo ID and credit card required at check-in.
          </Text>
        </View>

        {/* 5. Guest Responsibilities & Conduct */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. GUEST RESPONSIBILITIES & CONDUCT</Text>
          <Text style={styles.bodyText}>
            <Text style={styles.bold}>5.1 Respect for Property: </Text>
            Guests are responsible for any damage to rooms, facilities, or estate property caused
            by themselves, their children, or their guests. Full repair or replacement costs will
            be charged.
          </Text>
          <Text style={styles.bodyText}>
            <Text style={styles.bold}>5.2 Children Supervision: </Text>
            Parents/guardians are fully responsible for supervising children at all times. Any
            damage caused by minors will be charged to the booking party. Children must be
            supervised in wellness facilities, pools, and common areas.
          </Text>
          <Text style={styles.bodyText}>
            <Text style={styles.bold}>5.3 Maximum Occupancy: </Text>
            Do not exceed the maximum occupancy limit for your accommodation. Unauthorized guests
            may result in additional charges or termination of stay.
          </Text>
          <Text style={styles.bodyText}>
            <Text style={styles.bold}>5.4 Prohibited Activities: </Text>
            Smoking in non-designated areas (XAF 50,000 cleaning fee), loud noise after 10:00 PM,
            illegal activities, weapons, unauthorized commercial use, pets (unless pre-approved),
            and parties without permission are strictly prohibited.
          </Text>
        </View>

        {/* 6. Damage & Liability */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. DAMAGE & LIABILITY</Text>
          <Text style={styles.bodyText}>
            <Text style={styles.bold}>6.1 Guest Liability: </Text>
            Guests are financially responsible for any damage, loss, or theft of Fayshaa property
            during their stay. This includes damage to furniture, fixtures, linens, electronics,
            artwork, or any estate amenities.
          </Text>
          <Text style={styles.bodyText}>
            <Text style={styles.bold}>6.2 Damage Assessment: </Text>
            Damage will be assessed after departure. Charges will be made to the payment method
            on file. Fayshaa reserves the right to charge replacement or repair costs.
          </Text>
          <Text style={styles.bodyText}>
            <Text style={styles.bold}>6.3 Security Deposit: </Text>
            A refundable security deposit may be held on your credit card and released 3-7 days
            after check-out, subject to damage inspection.
          </Text>
          <Text style={styles.bodyText}>
            <Text style={styles.bold}>6.4 Guest Property: </Text>
            Fayshaa is not responsible for loss, theft, or damage to guests' personal belongings.
            Safe deposit boxes are available for valuables.
          </Text>
        </View>

        {/* 7. Safety & Security */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. SAFETY & SECURITY</Text>
          <Text style={styles.bodyText}>
            <Text style={styles.bold}>7.1 Estate Access: </Text>
            Digital keys and QR codes are for registered guests only. Sharing access credentials
            is prohibited and may result in immediate termination of stay.
          </Text>
          <Text style={styles.bodyText}>
            <Text style={styles.bold}>7.2 Emergency Procedures: </Text>
            Familiarize yourself with emergency exits and procedures. In case of emergency,
            call +237 653 255 547 immediately.
          </Text>
          <Text style={styles.bodyText}>
            <Text style={styles.bold}>7.3 Health & Safety Compliance: </Text>
            Guests must comply with all health and safety regulations, including pool rules,
            spa guidelines, and gym safety protocols.
          </Text>
          <Text style={styles.bodyText}>
            <Text style={styles.bold}>7.4 Medical Emergencies: </Text>
            Fayshaa staff are trained in first aid. For serious medical emergencies, local
            medical services will be contacted. Medical costs are the responsibility of the guest.
          </Text>
        </View>

        {/* 8. Wellness Services */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. WELLNESS SERVICES</Text>
          <Text style={styles.bodyText}>
            <Text style={styles.bold}>8.1 Service Bookings: </Text>
            Spa, fitness, and wellness services require advance booking. Cancellations must be
            made 24 hours in advance to avoid charges.
          </Text>
          <Text style={styles.bodyText}>
            <Text style={styles.bold}>8.2 Health Disclosure: </Text>
            Guests must disclose any medical conditions or injuries before participating in
            wellness activities. Fayshaa is not liable for injuries resulting from non-disclosure.
          </Text>
          <Text style={styles.bodyText}>
            <Text style={styles.bold}>8.3 Assumption of Risk: </Text>
            Participation in physical activities is at your own risk. Consult medical professionals
            before engaging in strenuous activities.
          </Text>
        </View>

        {/* 9. Food & Beverage */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. FOOD & BEVERAGE</Text>
          <Text style={styles.bodyText}>
            <Text style={styles.bold}>9.1 Dining Reservations: </Text>
            Restaurant reservations recommended, especially for dinner at The Sky Deck.
          </Text>
          <Text style={styles.bodyText}>
            <Text style={styles.bold}>9.2 Dietary Requirements: </Text>
            Please notify us of allergies or dietary restrictions in advance. While we accommodate
            requests, we cannot guarantee allergen-free environments.
          </Text>
          <Text style={styles.bodyText}>
            <Text style={styles.bold}>9.3 Outside Food & Beverage: </Text>
            Outside food and beverages are not permitted in dining areas but allowed in villa
            accommodations.
          </Text>
        </View>

        {/* 10. Right to Refuse Service */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. RIGHT TO REFUSE SERVICE</Text>
          <Text style={styles.bodyText}>
            Fayshaa reserves the right to refuse service or terminate the stay of any guest who:
            {'\n'}• Violates these terms and conditions
            {'\n'}• Engages in illegal activities
            {'\n'}• Behaves in a disruptive, threatening, or abusive manner
            {'\n'}• Damages property or endangers others
            {'\n'}• Fails to pay for services rendered
            {'\n\n'}
            No refund will be provided for terminated stays due to guest misconduct.
          </Text>
        </View>

        {/* 11. Limitation of Liability */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>11. LIMITATION OF LIABILITY</Text>
          <Text style={styles.bodyText}>
            Fayshaa Wellness Residence, its owners, and staff are not liable for:
            {'\n'}• Personal injury except where caused by our negligence
            {'\n'}• Loss or damage to personal property
            {'\n'}• Service interruptions due to maintenance or circumstances beyond our control
            {'\n'}• Injuries resulting from guest negligence or failure to follow safety guidelines
            {'\n'}• Third-party services arranged on behalf of guests
          </Text>
        </View>

        {/* 12. Force Majeure */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>12. FORCE MAJEURE</Text>
          <Text style={styles.bodyText}>
            Fayshaa is not responsible for failure to perform obligations due to circumstances
            beyond our control, including natural disasters, war, pandemics, government actions,
            or utility failures. In such cases, we will work with guests to reschedule or provide
            partial refunds at our discretion.
          </Text>
        </View>

        {/* 13. Photography & Marketing */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>13. PHOTOGRAPHY & MARKETING</Text>
          <Text style={styles.bodyText}>
            Fayshaa may take photographs or videos of the property and common areas for marketing
            purposes. While we avoid photographing identifiable guests, your presence on the estate
            constitutes consent to incidental inclusion in such materials.
          </Text>
        </View>

        {/* 14. Governing Law */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>14. GOVERNING LAW</Text>
          <Text style={styles.bodyText}>
            These terms are governed by the laws of Cameroon. Any disputes shall be resolved in
            the courts of Cameroon. By booking with Fayshaa, you consent to the exclusive
            jurisdiction of these courts.
          </Text>
        </View>

        {/* 15. Modifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>15. MODIFICATIONS TO TERMS</Text>
          <Text style={styles.bodyText}>
            Fayshaa reserves the right to modify these terms at any time. Guests will be notified
            of significant changes. Continued use of services after modifications constitutes
            acceptance of updated terms.
          </Text>
        </View>

        {/* 16. Contact Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>16. CONTACT INFORMATION</Text>
          <Text style={styles.bodyText}>
            For questions regarding these Terms & Conditions:
            {'\n\n'}
            <Text style={styles.bold}>Fayshaa Wellness Residence</Text>
            {'\n'}Emergency: +237 653 255 547
            {'\n'}Concierge: +237 651 841 003
            {'\n'}Website: www.fayshaa.com
            {'\n'}Email: info@fayshaa.com
          </Text>
        </View>

        {/* Acceptance Footer */}
        <LinearGradient
          colors={['rgba(200, 164, 93, 0.12)', 'rgba(200, 164, 93, 0.05)']}
          style={styles.acceptanceCard}
        >
          <Text style={styles.acceptanceText}>
            By using Fayshaa services, you acknowledge that you have read and agree to these
            Terms & Conditions in their entirety.
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
