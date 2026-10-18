import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/api';

export default function PersonalDetailsScreen({ navigation }) {
  const { user, refreshUserData } = useAuth();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    nationality: '',
    emergencyContact: '',
    emergencyPhone: '',
    dietaryPreferences: '',
    allergies: '',
  });

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch user profile on mount
  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/auth/me');

      if (response.success) {
        const userData = response.user;
        setFormData({
          fullName: userData.fullName || '',
          email: userData.email || '',
          phone: userData.phone || '',
          dateOfBirth: userData.dateOfBirth || '',
          nationality: userData.nationality || '',
          emergencyContact: userData.emergencyContact || '',
          emergencyPhone: userData.emergencyPhone || '',
          dietaryPreferences: userData.dietaryPreferences || '',
          allergies: userData.allergies || '',
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Validate required fields
      if (!formData.fullName.trim()) {
        Alert.alert('Validation Error', 'Full name is required');
        return;
      }

      // Make API call to update profile
      const response = await apiClient.put('/auth/profile', {
        fullName: formData.fullName,
        phone: formData.phone,
        dateOfBirth: formData.dateOfBirth || null,
        nationality: formData.nationality,
        emergencyContact: formData.emergencyContact,
        emergencyPhone: formData.emergencyPhone,
        dietaryPreferences: formData.dietaryPreferences,
        allergies: formData.allergies,
      });

      if (response.success) {
        // Refresh user data in AuthContext
        await refreshUserData();

        Alert.alert('Success', 'Your profile has been updated successfully');
        setIsEditing(false);
      } else {
        Alert.alert('Error', response.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', error.error || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form to original values by re-fetching
    fetchUserProfile();
    setIsEditing(false);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  const renderInput = (label, value, key, placeholder, keyboardType = 'default') => (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={[styles.input, !isEditing && styles.inputDisabled]}
        value={value}
        onChangeText={(text) => setFormData({ ...formData, [key]: text })}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textTertiary}
        editable={isEditing}
        keyboardType={keyboardType}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Personal Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PERSONAL INFORMATION</Text>
          <View style={styles.card}>
            {renderInput('Full Name', formData.fullName, 'fullName', 'Enter your full name')}
            {renderInput('Email', formData.email, 'email', 'Enter your email', 'email-address')}
            {renderInput('Phone', formData.phone, 'phone', 'Enter your phone number', 'phone-pad')}
            {renderInput('Date of Birth', formData.dateOfBirth, 'dateOfBirth', 'DD/MM/YYYY')}
            {renderInput('Nationality', formData.nationality, 'nationality', 'Enter your nationality')}
          </View>
        </View>

        {/* Emergency Contact */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>EMERGENCY CONTACT</Text>
          <View style={styles.card}>
            {renderInput('Contact Name', formData.emergencyContact, 'emergencyContact', 'Enter emergency contact name')}
            {renderInput('Contact Phone', formData.emergencyPhone, 'emergencyPhone', 'Enter emergency contact phone', 'phone-pad')}
          </View>
        </View>

        {/* Wellness Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WELLNESS PREFERENCES</Text>
          <View style={styles.card}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Dietary Preferences</Text>
              <TextInput
                style={[styles.textArea, !isEditing && styles.inputDisabled]}
                value={formData.dietaryPreferences}
                onChangeText={(text) => setFormData({ ...formData, dietaryPreferences: text })}
                placeholder="E.g., Vegetarian, Vegan, Gluten-free..."
                placeholderTextColor={COLORS.textTertiary}
                editable={isEditing}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Allergies</Text>
              <TextInput
                style={[styles.textArea, !isEditing && styles.inputDisabled]}
                value={formData.allergies}
                onChangeText={(text) => setFormData({ ...formData, allergies: text })}
                placeholder="List any food or other allergies..."
                placeholderTextColor={COLORS.textTertiary}
                editable={isEditing}
                multiline
                numberOfLines={3}
              />
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        {!isEditing ? (
          <TouchableOpacity
            onPress={() => setIsEditing(true)}
            activeOpacity={0.85}
            disabled={saving}
          >
            <LinearGradient
              colors={['#C8A45D', '#D68910']}
              style={styles.editButton}
            >
              <Text style={styles.editButtonText}>EDIT PROFILE</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <View style={styles.buttonRow}>
            <TouchableOpacity
              onPress={handleCancel}
              activeOpacity={0.85}
              style={styles.cancelButton}
            >
              <LinearGradient
                colors={['rgba(200, 164, 93, 0.08)', 'rgba(200, 164, 93, 0.03)']}
                style={styles.cancelButtonInner}
              >
                <Text style={styles.cancelButtonText}>CANCEL</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSave}
              activeOpacity={0.85}
              style={styles.saveButton}
              disabled={saving}
            >
              <LinearGradient
                colors={['#C8A45D', '#D68910']}
                style={styles.saveButtonInner}
              >
                {saving ? (
                  <ActivityIndicator color={COLORS.background} />
                ) : (
                  <Text style={styles.saveButtonText}>SAVE CHANGES</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* Info Note */}
        <LinearGradient
          colors={['rgba(200, 164, 93, 0.08)', 'rgba(200, 164, 93, 0.03)']}
          style={styles.infoNote}
        >
          <Text style={styles.infoIcon}>ℹ️</Text>
          <Text style={styles.infoText}>
            Your information is securely stored and used to personalize your Faysha experience.
            We never share your data with third parties.
          </Text>
        </LinearGradient>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
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
    marginTop: 20,
  },

  // Card
  card: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 18,
  },

  // Input
  inputGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 11,
    letterSpacing: 1,
    color: COLORS.textSecondary,
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: COLORS.text,
  },
  inputDisabled: {
    opacity: 0.7,
  },
  textArea: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: COLORS.text,
    height: 80,
    textAlignVertical: 'top',
  },

  // Buttons
  editButton: {
    marginHorizontal: 22,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  editButtonText: {
    fontSize: 12,
    letterSpacing: 1.5,
    color: COLORS.background,
    fontWeight: '700',
  },

  buttonRow: {
    flexDirection: 'row',
    paddingHorizontal: 22,
    gap: 12,
    marginBottom: 20,
  },
  cancelButton: {
    flex: 1,
  },
  cancelButtonInner: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(200, 164, 93, 0.3)',
  },
  cancelButtonText: {
    fontSize: 12,
    letterSpacing: 1.5,
    color: COLORS.primary,
    fontWeight: '700',
  },
  saveButton: {
    flex: 1,
  },
  saveButtonInner: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  saveButtonText: {
    fontSize: 12,
    letterSpacing: 1.5,
    color: COLORS.background,
    fontWeight: '700',
  },

  // Info Note
  infoNote: {
    marginHorizontal: 22,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(200, 164, 93, 0.3)',
    flexDirection: 'row',
    gap: 12,
  },
  infoIcon: {
    fontSize: 16,
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textSecondary,
  },
});
