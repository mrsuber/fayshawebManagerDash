import * as Clipboard from 'expo-clipboard';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

export default function DepositBoxScreen({ navigation, route }) {
  const { user } = useAuth();
  const { bookingId, depositBoxData: initialDepositBoxData } = route.params || {};

  const [activeTab, setActiveTab] = useState('current');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [depositBoxData, setDepositBoxData] = useState(initialDepositBoxData || null);
  const [packageHistory, setPackageHistory] = useState([]);

  useEffect(() => {
    fetchDepositBoxData();
  }, [bookingId]);

  const fetchDepositBoxData = async () => {
    try {
      // If we have initial data but no bookingId, just use the initial data
      if (!bookingId) {
        if (initialDepositBoxData) {
          setDepositBoxData(initialDepositBoxData);
        }
        setLoading(false);
        return;
      }

      // Try to fetch from API, but if it fails, use initial data as fallback
      try {
        const response = await api.get(`/deposit-box/booking/${bookingId}`);

        if (response.success) {
          setDepositBoxData(response.depositBox);
          // Format package dates
          const formattedPackages = response.packages.map(pkg => {
          const deliveryDate = new Date(pkg.deliveryDate);
          const now = new Date();
          const isToday = deliveryDate.toDateString() === now.toDateString();
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          const isYesterday = deliveryDate.toDateString() === yesterday.toDateString();

          let dateStr;
          if (isToday) {
            dateStr = `Today, ${deliveryDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
          } else if (isYesterday) {
            dateStr = `Yesterday, ${deliveryDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
          } else {
            dateStr = deliveryDate.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
          }

          let collectedAtStr = null;
          if (pkg.collectedAt) {
            const collectedDate = new Date(pkg.collectedAt);
            const isCollectedToday = collectedDate.toDateString() === now.toDateString();
            const isCollectedYesterday = collectedDate.toDateString() === yesterday.toDateString();

            if (isCollectedToday) {
              collectedAtStr = `Today, ${collectedDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
            } else if (isCollectedYesterday) {
              collectedAtStr = `Yesterday, ${collectedDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
            } else {
              collectedAtStr = collectedDate.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
            }
          }

            return {
              ...pkg,
              deliveryDate: dateStr,
              collectedAt: collectedAtStr
            };
          });
          setPackageHistory(formattedPackages);
        }
      } catch (apiError) {
        console.log('API not available, using initial data:', apiError.message);
        // If API fails but we have initial data, use it
        if (initialDepositBoxData) {
          setDepositBoxData(initialDepositBoxData);
        }
        // Package history will be empty, but that's ok
        setPackageHistory([]);
      }
    } catch (error) {
      console.error('Error fetching deposit box data:', error);
      // Don't show error alert if we have initial data
      if (!initialDepositBoxData) {
        Alert.alert('Error', 'Failed to load deposit box information');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDepositBoxData();
  };

  const copyToClipboard = (text, label) => {
    Clipboard.setStringAsync(String(text ?? '')).catch(() => {});
    Alert.alert('Copied!', `${label} copied to clipboard`);
  };

  const handleMarkAsCollected = async (packageId) => {
    Alert.alert(
      'Mark as Collected',
      'Have you collected this package from the deposit box?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Collected',
          onPress: async () => {
            try {
              const response = await api.post(`/deposit-box/package/${packageId}/collect`, {
                user_id: user.id
              });

              if (response.success) {
                Alert.alert('Success', 'Package marked as collected');
                // Refresh data
                fetchDepositBoxData();
              }
            } catch (error) {
              console.error('Error marking package as collected:', error);
              Alert.alert('Error', 'Failed to mark package as collected');
            }
          },
        },
      ]
    );
  };

  const renderPackageCard = (pkg) => (
    <View key={pkg.id} style={styles.packageCard}>
      <LinearGradient
        colors={
          pkg.status === 'waiting'
            ? ['rgba(200, 164, 93, 0.15)', 'rgba(200, 164, 93, 0.05)']
            : ['rgba(13, 13, 13, 0.4)', 'rgba(13, 13, 13, 0.6)']
        }
        style={styles.packageGradient}
      >
        {/* Header */}
        <View style={styles.packageHeader}>
          <View style={styles.packageHeaderLeft}>
            <Text style={styles.packageDate}>{pkg.deliveryDate}</Text>
            <Text style={styles.packageCarrier}>📦 {pkg.deliveredBy}</Text>
          </View>
          <View
            style={[
              styles.packageStatusBadge,
              pkg.status === 'waiting' && styles.packageStatusWaiting,
            ]}
          >
            <Text
              style={[
                styles.packageStatusText,
                pkg.status === 'waiting' && styles.packageStatusTextWaiting,
              ]}
            >
              {pkg.status === 'waiting' ? 'WAITING' : 'COLLECTED'}
            </Text>
          </View>
        </View>

        {/* Tracking Number */}
        <TouchableOpacity
          style={styles.trackingRow}
          onPress={() => copyToClipboard(pkg.trackingNumber, 'Tracking number')}
          activeOpacity={0.8}
        >
          <Text style={styles.trackingLabel}>Tracking #</Text>
          <Text style={styles.trackingNumber}>{pkg.trackingNumber}</Text>
          <Text style={styles.trackingCopy}>📋</Text>
        </TouchableOpacity>

        {/* PIN Information */}
        <View style={styles.pinInfoSection}>
          <View style={styles.pinChangeRow}>
            <View style={styles.pinChangeItem}>
              <Text style={styles.pinChangeLabel}>Delivery PIN Used</Text>
              <Text style={styles.pinChangeValue}>{pkg.pinUsedByDelivery}</Text>
            </View>
            <Text style={styles.pinChangeArrow}>→</Text>
            <View style={styles.pinChangeItem}>
              <Text style={styles.pinChangeLabel}>New PIN Generated</Text>
              <Text style={styles.pinChangeValueNew}>{pkg.newPinGenerated}</Text>
            </View>
          </View>
        </View>

        {/* Collected Info or Action */}
        {pkg.status === 'collected' ? (
          <View style={styles.collectedInfo}>
            <Text style={styles.collectedIcon}>✓</Text>
            <Text style={styles.collectedText}>Collected {pkg.collectedAt}</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.collectButton}
            onPress={() => handleMarkAsCollected(pkg.id)}
            activeOpacity={0.8}
          >
            <Text style={styles.collectButtonText}>Mark as Collected</Text>
          </TouchableOpacity>
        )}
      </LinearGradient>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading deposit box...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!depositBoxData) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Deposit Box</Text>
          </View>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyTitle}>No Deposit Box</Text>
          <Text style={styles.emptyText}>
            No deposit box assigned to this booking
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Deposit Box</Text>
          <Text style={styles.headerSubtitle}>Box {depositBoxData.boxNumber}</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      {/* Current Box Status Card */}
      <View style={styles.currentBoxCard}>
        <LinearGradient
          colors={['rgba(200, 164, 93, 0.2)', 'rgba(200, 164, 93, 0.1)']}
          style={styles.currentBoxGradient}
        >
          <View style={styles.currentBoxHeader}>
            <Text style={styles.currentBoxTitle}>Current Access PIN</Text>
            {depositBoxData.hasNewPackage && (
              <View style={styles.newPackagePill}>
                <Text style={styles.newPackagePillText}>
                  {depositBoxData.packageCount} NEW PACKAGE
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.currentPinBox}
            onPress={() => copyToClipboard(depositBoxData.currentPin, 'Current PIN')}
            activeOpacity={0.8}
          >
            <Text style={styles.currentPinDisplay}>{depositBoxData.currentPin}</Text>
            <View style={styles.copyPinBadge}>
              <Text style={styles.copyPinText}>TAP TO COPY</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.securityNote}>
            <Text style={styles.securityNoteIcon}>🔒</Text>
            <Text style={styles.securityNoteText}>
              PIN changes automatically after delivery agent opens box
            </Text>
          </View>

          <Text style={styles.lastUpdatedText}>Updated {depositBoxData.lastUpdated}</Text>
        </LinearGradient>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'current' && styles.tabActive]}
          onPress={() => setActiveTab('current')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'current' && styles.tabTextActive]}>
            CURRENT STAY
          </Text>
        </TouchableOpacity>
      </View>

      {/* Package History */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
        <View style={styles.historyHeader}>
          <Text style={styles.historyTitle}>Package History</Text>
          <Text style={styles.historyCount}>{packageHistory.length} deliveries</Text>
        </View>

        {packageHistory.length > 0 ? (
          packageHistory.map(renderPackageCard)
        ) : (
          <View style={styles.emptyPackagesCard}>
            <Text style={styles.emptyPackagesIcon}>📭</Text>
            <Text style={styles.emptyPackagesTitle}>No Package Deliveries Yet</Text>
            <Text style={styles.emptyPackagesText}>
              When packages are delivered to your deposit box, they'll appear here with tracking information and auto-generated access PINs.
            </Text>
          </View>
        )}

        {/* Info Message */}
        <View style={styles.infoMessage}>
          <Text style={styles.infoMessageIcon}>ℹ️</Text>
          <Text style={styles.infoMessageText}>
            Your package history is reset when you check out. Only deliveries during your
            current stay are shown.
          </Text>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(242, 233, 216, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: COLORS.text,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: FONTS.heading,
    fontSize: 18,
    color: COLORS.text,
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textTertiary,
  },
  headerRight: {
    width: 40,
  },

  // Current Box Status Card
  currentBoxCard: {
    margin: 22,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(200, 164, 93, 0.4)',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  currentBoxGradient: {
    padding: 20,
  },
  currentBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  currentBoxTitle: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '700',
    letterSpacing: 1,
  },
  newPackagePill: {
    backgroundColor: 'rgba(200, 164, 93, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  newPackagePillText: {
    fontSize: 9,
    letterSpacing: 1,
    color: COLORS.primary,
    fontWeight: '700',
  },
  currentPinBox: {
    backgroundColor: 'rgba(13, 13, 13, 0.4)',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  currentPinDisplay: {
    fontFamily: FONTS.heading,
    fontSize: 48,
    letterSpacing: 12,
    color: COLORS.primary,
    marginBottom: 12,
  },
  copyPinBadge: {
    backgroundColor: 'rgba(200, 164, 93, 0.2)',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  copyPinText: {
    fontSize: 10,
    letterSpacing: 1,
    color: COLORS.primary,
    fontWeight: '600',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(200, 164, 93, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  securityNoteIcon: {
    fontSize: 16,
  },
  securityNoteText: {
    flex: 1,
    fontSize: 11,
    color: 'rgba(242, 233, 216, 0.75)',
    lineHeight: 16,
  },
  lastUpdatedText: {
    fontSize: 11,
    color: COLORS.textTertiary,
    textAlign: 'center',
  },

  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 22,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 20,
  },
  tab: {
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: 11,
    letterSpacing: 1.5,
    color: COLORS.textTertiary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: COLORS.primary,
  },

  // Scroll View
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
  },

  // History Header
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  historyTitle: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '700',
  },
  historyCount: {
    fontSize: 12,
    color: COLORS.textTertiary,
  },

  // Package Card
  packageCard: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  packageGradient: {
    padding: 16,
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  packageHeaderLeft: {
    flex: 1,
  },
  packageDate: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  packageCarrier: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  packageStatusBadge: {
    backgroundColor: 'rgba(242, 233, 216, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(242, 233, 216, 0.2)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  packageStatusWaiting: {
    backgroundColor: 'rgba(200, 164, 93, 0.2)',
    borderColor: COLORS.primary,
  },
  packageStatusText: {
    fontSize: 9,
    letterSpacing: 1,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  packageStatusTextWaiting: {
    color: COLORS.primary,
  },

  // Tracking
  trackingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13, 13, 13, 0.3)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  trackingLabel: {
    fontSize: 11,
    color: COLORS.textTertiary,
  },
  trackingNumber: {
    flex: 1,
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '600',
  },
  trackingCopy: {
    fontSize: 14,
  },

  // PIN Info
  pinInfoSection: {
    backgroundColor: 'rgba(13, 13, 13, 0.3)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  pinChangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  pinChangeItem: {
    flex: 1,
    alignItems: 'center',
  },
  pinChangeLabel: {
    fontSize: 9,
    color: COLORS.textTertiary,
    marginBottom: 4,
    textAlign: 'center',
  },
  pinChangeValue: {
    fontSize: 16,
    color: 'rgba(242, 233, 216, 0.5)',
    fontWeight: '700',
    letterSpacing: 2,
  },
  pinChangeValueNew: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '700',
    letterSpacing: 2,
  },
  pinChangeArrow: {
    fontSize: 18,
    color: COLORS.textTertiary,
  },

  // Collected Info
  collectedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  collectedIcon: {
    fontSize: 16,
    color: '#7fae8a',
  },
  collectedText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  // Collect Button
  collectButton: {
    backgroundColor: 'rgba(200, 164, 93, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(200, 164, 93, 0.4)',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  collectButtonText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  // Info Message
  infoMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(200, 164, 93, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(200, 164, 93, 0.2)',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    gap: 12,
  },
  infoMessageIcon: {
    fontSize: 18,
  },
  infoMessageText: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(242, 233, 216, 0.7)',
    lineHeight: 18,
  },

  bottomSpacing: {
    height: 40,
  },

  // Loading and Empty States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 16,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Empty Packages State
  emptyPackagesCard: {
    backgroundColor: 'rgba(200, 164, 93, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(200, 164, 93, 0.2)',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyPackagesIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyPackagesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyPackagesText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
