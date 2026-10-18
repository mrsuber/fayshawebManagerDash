import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONTS } from '../../constants/theme';
import { PROFILE_ITEMS } from '../../constants/wellnessData';
import { useAuth } from '../../contexts/AuthContext';
import { APP } from '../../config';

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();


  const handleItemPress = (item) => {
    // Navigate to specific screens
    if (item.label === 'My Stays') {
      navigation.navigate('MyStays');
    } else if (item.label === 'Personal Details') {
      navigation.navigate('PersonalDetails');
    } else if (item.label === 'Rewards') {
      navigation.navigate('Rewards');
    } else if (item.label === 'Settings') {
      navigation.navigate('Settings');
    } else if (item.screen) {
      navigation.navigate(item.screen);
    }
  };

  const handleLogout = async () => {
    try {
      // Call logout from AuthContext which will clear storage and call backend
      await logout();

      // The app returns to the welcome screen by itself once signed out.
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Get user initials
  const getUserInitials = () => {
    const name = user?.fullName || user?.full_name;
    if (!name) return 'G';
    const names = name.trim().split(/\s+/);
    return names.map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const joined = user?.createdAt || user?.created_at;
  const memberSince = joined ? new Date(joined).getFullYear() : new Date().getFullYear();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header Card */}
        <LinearGradient
          colors={['rgba(200, 164, 93, 0.15)', 'rgba(200, 164, 93, 0.05)']}
          style={styles.profileHeader}
        >
          <LinearGradient
            colors={['#C8A45D', '#D68910']}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>{getUserInitials()}</Text>
          </LinearGradient>
          <Text style={styles.userName}>{user?.fullName || user?.full_name || 'Guest'}</Text>
          <Text style={styles.userEmail}>{user?.email || ''}</Text>
          <View style={styles.membershipBadge}>
            <Text style={styles.membershipText}>MEMBER SINCE {memberSince}</Text>
          </View>
        </LinearGradient>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          <View style={styles.menuGroup}>
            {PROFILE_ITEMS.slice(0, 3).map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.menuItem,
                  index === 0 && styles.menuItemFirst,
                  index === 2 && styles.menuItemLast,
                ]}
                onPress={() => handleItemPress(item)}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['rgba(200, 164, 93, 0.15)', 'rgba(200, 164, 93, 0.08)']}
                  style={styles.menuIcon}
                >
                  <Text style={styles.menuGlyph}>{item.glyph}</Text>
                </LinearGradient>
                <Text style={styles.menuLabel}>{item.label}</Text>

                {/* Notification Badge for Deposit Box */}
                {item.hasNotification && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationDot}>●</Text>
                  </View>
                )}

                <View style={styles.menuChevronContainer}>
                  <Text style={styles.menuChevron}>›</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PREFERENCES</Text>
          <View style={styles.menuGroup}>
            {PROFILE_ITEMS.slice(3).map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.menuItem,
                  index === 0 && styles.menuItemFirst,
                  index === PROFILE_ITEMS.slice(3).length - 1 && styles.menuItemLast,
                ]}
                onPress={() => handleItemPress(item)}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['rgba(200, 164, 93, 0.15)', 'rgba(200, 164, 93, 0.08)']}
                  style={styles.menuIcon}
                >
                  <Text style={styles.menuGlyph}>{item.glyph}</Text>
                </LinearGradient>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <View style={styles.menuChevronContainer}>
                  <Text style={styles.menuChevron}>›</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Help & Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>HELP & SUPPORT</Text>
          <View style={styles.menuGroup}>
            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemFirst]}
              onPress={() => navigation.navigate('Terms')}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['rgba(200, 164, 93, 0.15)', 'rgba(200, 164, 93, 0.08)']}
                style={styles.menuIcon}
              >
                <Text style={styles.menuGlyph}>📄</Text>
              </LinearGradient>
              <Text style={styles.menuLabel}>Terms & Conditions</Text>
              <View style={styles.menuChevronContainer}>
                <Text style={styles.menuChevron}>›</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('Privacy')}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['rgba(200, 164, 93, 0.15)', 'rgba(200, 164, 93, 0.08)']}
                style={styles.menuIcon}
              >
                <Text style={styles.menuGlyph}>🔒</Text>
              </LinearGradient>
              <Text style={styles.menuLabel}>Privacy Policy</Text>
              <View style={styles.menuChevronContainer}>
                <Text style={styles.menuChevron}>›</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemLast]}
              onPress={() => navigation.navigate('Concierge')}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['rgba(200, 164, 93, 0.15)', 'rgba(200, 164, 93, 0.08)']}
                style={styles.menuIcon}
              >
                <Text style={styles.menuGlyph}>💬</Text>
              </LinearGradient>
              <Text style={styles.menuLabel}>Contact Support</Text>
              <View style={styles.menuChevronContainer}>
                <Text style={styles.menuChevron}>›</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          onPress={() =>
            Alert.alert('Log out?', 'You can sign back in at any time.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Log out', style: 'destructive', onPress: handleLogout },
            ])
          }
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['rgba(200, 164, 93, 0.08)', 'rgba(200, 164, 93, 0.03)']}
            style={styles.logoutButton}
          >
            <Text style={styles.logoutText}>LOG OUT</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* App Version */}
        <Text style={styles.versionText}>Faysha Wellness Residence · v{APP.version}</Text>
      </ScrollView>
    </SafeAreaView>
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
    paddingBottom: 100,
  },

  // Profile Header Card
  profileHeader: {
    marginHorizontal: 22,
    marginTop: 20,
    marginBottom: 28,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(200, 164, 93, 0.4)',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  avatarText: {
    fontFamily: FONTS.heading,
    fontSize: 32,
    color: COLORS.background,
    fontWeight: '700',
  },
  userName: {
    fontFamily: FONTS.heading,
    fontSize: 20,
    color: COLORS.text,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 14,
  },
  membershipBadge: {
    backgroundColor: 'rgba(200, 164, 93, 0.2)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(200, 164, 93, 0.4)',
  },
  membershipText: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: COLORS.primary,
    fontWeight: '700',
  },

  // Section
  section: {
    marginBottom: 24,
    paddingHorizontal: 22,
  },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 2,
    color: COLORS.textTertiary,
    fontWeight: '700',
    marginBottom: 12,
  },

  // Menu Group
  menuGroup: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  menuItemFirst: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  menuItemLast: {
    borderBottomWidth: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(200, 164, 93, 0.3)',
  },
  menuGlyph: {
    fontSize: 16,
  },
  menuLabel: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
  },
  menuChevronContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(200, 164, 93, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuChevron: {
    fontSize: 14,
    color: COLORS.primary,
  },

  // Notification Badge
  notificationBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  notificationDot: {
    fontSize: 8,
    color: COLORS.primary,
  },

  // Logout Button
  logoutButton: {
    marginHorizontal: 22,
    marginTop: 8,
    marginBottom: 16,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(200, 164, 93, 0.3)',
  },
  logoutText: {
    fontSize: 12,
    letterSpacing: 1.5,
    color: COLORS.primary,
    fontWeight: '700',
  },

  versionText: {
    fontSize: 11,
    color: COLORS.textTertiary,
    textAlign: 'center',
    marginBottom: 20,
  },
});
