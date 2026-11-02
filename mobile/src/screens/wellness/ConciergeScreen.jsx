import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, FONTS } from '../../constants/theme';
import { CONCIERGE_QUICK_REPLIES } from '../../constants/wellnessData';
import api from '../../services/api';
import { useChat, useLiveEvent } from '../../contexts/LiveContext';
import { SERVER_URL } from '../../config';

// Separate component for image attachment with error handling
const ImageAttachment = ({ fullUrl, url, name, onPress }) => {
  const [imageError, setImageError] = useState(false);

  if (imageError) {
    return (
      <TouchableOpacity
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: COLORS.background,
          padding: 12,
          borderRadius: 8,
          marginBottom: 8,
          borderWidth: 1,
          borderColor: '#ff6b6b',
          gap: 10,
        }}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Text style={{ fontSize: 32 }}>🖼️</Text>
        <View>
          <Text style={{ fontSize: 12, color: '#ff6b6b', fontWeight: '600' }}>
            Image failed to load
          </Text>
          <Text style={{ color: COLORS.textSecondary, fontSize: 10 }}>
            Tap to view in browser
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{ marginBottom: 8 }}
    >
      <Image
        source={{ uri: fullUrl }}
        style={{
          width: 200,
          height: 150,
          borderRadius: 8,
          marginBottom: 8,
        }}
        resizeMode="cover"
        onError={(error) => {
          console.error('Error loading image:', error.nativeEvent.error);
          console.error('Failed URL:', fullUrl);
          setImageError(true);
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: 14,
          right: 8,
          backgroundColor: 'rgba(0,0,0,0.7)',
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 4,
        }}
      >
        <Text style={{ color: COLORS.background, fontSize: 10 }}>
          📥 Tap to view
        </Text>
      </View>
    </TouchableOpacity>
  );
};

/** One entry per message id (the first copy wins). */
const withoutDuplicates = (list) => {
  const seen = new Set();
  return list.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
};

export default function ConciergeScreen() {
  const { markAllAsRead } = useChat();
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [attachedFile, setAttachedFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const scrollViewRef = useRef(null);

  // Fetch messages from API
  const fetchMessages = async () => {
    try {
      const response = await api.get('/wellness/concierge/messages?limit=100');
      if (response.success) {
        setMessages(withoutDuplicates(response.messages || []));
        setTimeout(() => scrollToBottom(), 100);

        // Mark all messages as read after fetching
        if (response.messages && response.messages.length > 0) {
          const latestMessage = response.messages[response.messages.length - 1];
          markAllAsRead();
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      Alert.alert('Error', 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  // Mark messages as read when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('💬 Concierge screen focused, marking all as read...');
      // Mark all messages as read when the screen is focused
      markAllAsRead();

      return () => {
        // When leaving the screen, ensure the home screen refreshes
        console.log('💬 Leaving Concierge screen');
      };
    }, [markAllAsRead])
  );

  useEffect(() => {
    fetchMessages();
  }, []);

  // New messages arrive over the app's live connection.
  useLiveEvent('new_message', (message) => {
    if (!message) return;
    setMessages((prev) => {
      if (prev.some((m) => m.id === message.id)) return prev;
      // My own message coming back over the live connection (staff accounts also get the guest feed) before the
      // send has answered: it replaces the pending copy instead of appearing twice.
      const pending = message.sender_type === 'user' ? prev.findIndex((m) => m._isOptimistic && m.status === 'sending' && m.message === message.message) : -1;
      if (pending >= 0) return prev.map((m, i) => (i === pending ? { ...message, status: 'sent' } : m));
      return [...prev, message];
    });
    if (message.sender_type === 'concierge') markAllAsRead();
    setTimeout(() => scrollToBottom(), 100);
  });

  const scrollToBottom = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  // A picked photo or document is kept as a local file and uploaded when sent (multipart, not base64:
  // a phone photo as base64 JSON is several megabytes and was refused by the server's request size limit).
  const asAttachment = (asset, type) => {
    const fallbackName = `${type === 'image' ? 'photo' : 'document'}_${Date.now()}`;
    const name = asset.fileName || asset.name || asset.uri.split('/').pop() || fallbackName;
    const mimeType = asset.mimeType || (type === 'image' ? 'image/jpeg' : 'application/pdf');
    if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
      Alert.alert('File too large', 'Files can be up to 10 MB.');
      return;
    }
    setAttachedFile({ type, name, uri: asset.uri, mimeType });
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to your photos to send one.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, exif: false });
      if (!result.canceled && result.assets?.[0]) asAttachment(result.assets[0], 'image');
    } catch (error) {
      Alert.alert('Could not open your photos', error.message);
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow camera access to take a photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6, exif: false });
      if (!result.canceled && result.assets?.[0]) asAttachment(result.assets[0], 'image');
    } catch (error) {
      Alert.alert('Could not open the camera', error.message);
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        asAttachment({ ...asset, fileSize: asset.size }, String(asset.mimeType || '').startsWith('image/') ? 'image' : 'document');
      }
    } catch (error) {
      Alert.alert('Could not open your files', error.message);
    }
  };

  const showAttachmentOptions = () => {
    Alert.alert(
      'Send a file',
      undefined,
      [
        { text: 'Take a photo', onPress: takePhoto },
        { text: 'Photo library', onPress: pickImage },
        { text: 'Document', onPress: pickDocument },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  /** Uploads the local file (POST /chat/attachments, multipart) → { url, name, type, mimeType, size }. */
  const uploadFile = async (file) => {
    setUploadProgress(5);
    try {
      const form = new FormData();
      form.append('file', { uri: file.uri, name: file.name, type: file.mimeType });
      const res = await api.post('/chat/attachments', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
        transformRequest: (data) => data,
        onUploadProgress: (e) => e.total && setUploadProgress(Math.max(5, Math.round((e.loaded / e.total) * 100))),
      });
      return res.attachment;
    } finally {
      setUploadProgress(0);
    }
  };

  // Send message with optimistic UI
  const sendMessage = async (text = messageText, file = attachedFile) => {

    if (!text.trim() && !file) return;

    // Generate unique local ID for optimistic message
    const localId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create optimistic message
    const optimisticMessage = {
      id: localId,
      message: text.trim() || (file?.type === 'image' ? '📷 Photo' : `📎 ${file?.name || 'File'}`),
      sender_type: 'user',
      created_at: new Date().toISOString(),
      metadata: file ? {
        attachment: {
          type: file.type,
          name: file.name,
          uri: file.uri, // Use local URI for immediate display
          mimeType: file.mimeType,
        }
      } : {},
      status: 'sending', // Local status
      _isOptimistic: true, // Flag for tracking
    };

    // ✅ Step 1: Show message immediately (OPTIMISTIC UI)
    setMessages(prev => [...prev, optimisticMessage]);
    setMessageText('');
    setAttachedFile(null);
    setSending(true);
    setTimeout(() => scrollToBottom(), 100);

    try {
      let uploadedAttachment = null;

      // Upload the file first; if that fails the message is not sent and the guest can retry.
      if (file) {
        uploadedAttachment = await uploadFile(file);
        setMessages(prev => prev.map(m => (m.id === localId ? { ...m, metadata: { attachment: { ...uploadedAttachment, uri: file.uri } } } : m)));
      }

      // ✅ Step 3: Send message to server
      const response = await api.post('/wellness/concierge/messages', {
        message: text.trim(),
        metadata: uploadedAttachment ? { attachment: uploadedAttachment } : {},
      });


      if (response.success) {
        // ✅ Step 4: Replace optimistic message with real message
        setMessages(prev => withoutDuplicates(prev.map(m =>
          m.id === localId
            ? { ...response.message, status: 'sent' }
            : m
        )));
      }
    } catch (error) {
      console.error('❌ Error sending message:', error);
      console.error('Error details:', {
        message: error.message,
        error: error.error,
        response: error.response?.data
      });

      // No answer (connection dropped or timed out): the server may still have saved the message. Check first,
      // so a retry does not send it twice.
      if (error?.offline && !file) {
        try {
          const latest = await api.get('/wellness/concierge/messages?limit=100');
          const saved = latest?.success && latest.messages.find((m) => m.sender_type === 'user' && m.message === text.trim() && new Date(m.created_at) >= new Date(Date.now() - 2 * 60 * 1000));
          if (saved) {
            setMessages((prev) => withoutDuplicates([...latest.messages, ...prev.filter((m) => m._isOptimistic && m.id !== localId)]));
            return;
          }
        } catch (e) {
          // still offline: fall through to the retry option
        }
      }

      // ✅ Mark message as failed with retry option
      setMessages(prev => prev.map(m =>
        m.id === localId
          ? { ...m, status: 'failed', error: error.message }
          : m
      ));

      Alert.alert(
        'Send Failed',
        'Message could not be sent. Tap the message to retry.',
        [{ text: 'OK' }]
      );
    } finally {
      setSending(false);
    }
  };

  // Handle quick reply
  const handleQuickReply = (quickReply) => {
    sendMessage(quickReply.label, null);
  };

  // Retry failed message
  const retryMessage = (msg) => {
    // Remove the failed message
    setMessages(prev => prev.filter(m => m.id !== msg.id));

    // Resend with original content
    const attachment = msg.metadata?.attachment;
    if (attachment) {
      setAttachedFile({
        type: attachment.type,
        name: attachment.name,
        uri: attachment.uri || attachment.url,
        mimeType: attachment.mimeType,
      });
    }
    sendMessage(msg.message, attachment ? {
      type: attachment.type,
      name: attachment.name,
      uri: attachment.uri || attachment.url,
      mimeType: attachment.mimeType,
    } : null);
  };

  // Download/View file
  const handleFilePress = async (url, name) => {
    try {
      const fullUrl = url.startsWith('http') ? url : `${SERVER_URL}${url}`;
      const supported = await Linking.canOpenURL(fullUrl);

      if (supported) {
        await Linking.openURL(fullUrl);
      } else {
        Alert.alert('Error', 'Cannot open this file');
      }
    } catch (error) {
      console.error('Error opening file:', error);
      Alert.alert('Error', 'Failed to open file');
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Render attachment
  const renderAttachment = (attachment) => {
    if (!attachment) {
      return null;
    }

    // Get the URL from attachment
    let url = attachment.url || attachment.uri;

    if (!url) {
      return (
        <View style={styles.errorAttachment}>
          <Text style={styles.errorText}>⚠️ Attachment unavailable</Text>
        </View>
      );
    }

    // Handle different URL types
    let fullUrl;
    if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('file://')) {
      // Already a complete URL or local file
      fullUrl = url;
    } else if (url.startsWith('/')) {
      // Relative path from server
      fullUrl = `${SERVER_URL}${url}`;
    } else {
      // Assume it's a path that needs base URL
      fullUrl = `${SERVER_URL}/${url}`;
    }

    if (attachment.type === 'image') {
      return (
        <ImageAttachment
          fullUrl={fullUrl}
          url={url}
          name={attachment.name}
          onPress={() => handleFilePress(url, attachment.name)}
        />
      );
    }

    return (
      <TouchableOpacity
        style={styles.documentAttachment}
        onPress={() => handleFilePress(url, attachment.name)}
        activeOpacity={0.8}
      >
        <Text style={styles.documentIcon}>📄</Text>
        <View style={styles.documentInfo}>
          <Text style={styles.documentName} numberOfLines={1}>
            {attachment.name}
          </Text>
          <Text style={styles.downloadText}>Tap to download</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top']}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Premium Header */}
      <LinearGradient
        colors={['rgba(200, 164, 93, 0.15)', 'rgba(200, 164, 93, 0.05)', COLORS.background]}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.avatarContainer}>
            <LinearGradient
              colors={['#C8A45D', '#D4B574']}
              style={styles.avatarGradient}
            >
              <Text style={styles.avatarIcon}>✦</Text>
            </LinearGradient>
            <View style={styles.onlineIndicator}>
              <View style={styles.onlineDot} />
            </View>
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Faysha Concierge</Text>
            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.headerSubtitle}>Online • 24/7 Support</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scrollToBottom()}
      >
        {messages.map((msg) => {
          const isUserMessage = msg.sender_type === 'user';
          // Backend already parses metadata, but handle both cases
          let metadata = msg.metadata;
          if (typeof metadata === 'string') {
            try {
              metadata = JSON.parse(metadata);
            } catch (e) {
              console.error('Error parsing metadata:', e);
              metadata = {};
            }
          }

          return (
            <View
              key={msg.id}
              style={[
                styles.messageWrapper,
                isUserMessage ? styles.messageWrapperUser : styles.messageWrapperConcierge,
              ]}
            >
              {isUserMessage ? (
                <LinearGradient
                  colors={['#C8A45D', '#D68910']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.messageBubble, styles.messageBubbleUser]}
                >
                  {metadata?.attachment && renderAttachment(metadata.attachment)}

                  {/* Only show message text if it's not just the attachment placeholder */}
                  {msg.message && !(metadata?.attachment && /^(📎 Sent an attachment|📷 Photo$|📎 )/.test(msg.message)) && (
                    <Text style={styles.messageTextUser}>
                      {msg.message}
                    </Text>
                  )}

                  <View style={styles.messageFooter}>
                    <Text style={styles.timestampUser}>
                      {formatTimestamp(msg.created_at)}
                    </Text>

                    {/* Status indicators for user messages */}
                    <View style={styles.statusIndicator}>
                      {msg.status === 'sending' && <Text style={styles.statusIcon}>⏳</Text>}
                      {msg.status === 'sent' && <Text style={styles.statusIcon}>✓</Text>}
                      {msg.status === 'delivered' && <Text style={styles.statusIcon}>✓✓</Text>}
                      {msg.status === 'failed' && (
                        <TouchableOpacity onPress={() => retryMessage(msg)}>
                          <Text style={styles.statusIconError}>⚠️ Retry</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </LinearGradient>
              ) : (
                <View style={[styles.messageBubble, styles.messageBubbleConcierge]}>
                  {metadata?.attachment && renderAttachment(metadata.attachment)}

                  {/* Only show message text if it's not just the attachment placeholder */}
                  {msg.message && !(metadata?.attachment && /^(📎 Sent an attachment|📷 Photo$|📎 )/.test(msg.message)) && (
                    <Text style={styles.messageTextConcierge}>
                      {msg.message}
                    </Text>
                  )}

                  <View style={styles.messageFooter}>
                    <Text style={styles.timestampConcierge}>
                      {formatTimestamp(msg.created_at)}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          );
        })}

        {messages.length === 0 && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <LinearGradient
                colors={['rgba(200, 164, 93, 0.2)', 'rgba(200, 164, 93, 0.1)']}
                style={styles.emptyIconGradient}
              >
                <Text style={styles.emptyIcon}>✦</Text>
              </LinearGradient>
            </View>
            <Text style={styles.emptyText}>Welcome to Faysha Concierge</Text>
            <Text style={styles.emptySubtext}>
              Your personal wellness companion is here to assist you with anything you need.
            </Text>
            <View style={styles.emptyFeatures}>
              <Text style={styles.featureItem}>💬 Instant responses</Text>
              <Text style={styles.featureItem}>🌟 Personalized recommendations</Text>
              <Text style={styles.featureItem}>🔔 24/7 availability</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Attachment Preview */}
      {attachedFile && (
        <View style={styles.attachmentPreview}>
          <View style={styles.previewContent}>
            {attachedFile.type === 'image' ? (
              <Image
                source={{ uri: attachedFile.uri }}
                style={styles.previewImage}
              />
            ) : (
              <Text style={styles.previewIcon}>📄</Text>
            )}
            <Text style={styles.previewName} numberOfLines={1}>
              {attachedFile.name}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setAttachedFile(null)}
            style={styles.removeButton}
          >
            <Text style={styles.removeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Premium Quick Reply Chips */}
      {messages.length === 0 && (
        <View style={styles.chipsContainer}>
          <Text style={styles.chipsLabel}>QUICK ACTIONS</Text>
          <View style={styles.chipsRow}>
            {CONCIERGE_QUICK_REPLIES.slice(0, 4).map((chip, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => handleQuickReply(chip)}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['rgba(200, 164, 93, 0.15)', 'rgba(200, 164, 93, 0.08)']}
                  style={styles.chip}
                >
                  <Text style={styles.chipText}>{chip.label}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Premium Message Input */}
      <View style={styles.inputContainer}>
        <TouchableOpacity
          style={styles.attachButton}
          onPress={showAttachmentOptions}
          disabled={sending}
          activeOpacity={0.8}
        >
          <Text style={styles.attachIcon}>📎</Text>
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder="Type your message..."
          placeholderTextColor={COLORS.textTertiary}
          value={messageText}
          onChangeText={setMessageText}
          multiline
          maxLength={1000}
          editable={!sending}
        />

        <TouchableOpacity
          onPress={() => sendMessage()}
          disabled={(!messageText.trim() && !attachedFile) || sending}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={(!messageText.trim() && !attachedFile) ? ['rgba(200, 164, 93, 0.3)', 'rgba(200, 164, 93, 0.2)'] : ['#C8A45D', '#D68910']}
            style={styles.sendButton}
          >
            {sending ? (
              <ActivityIndicator size="small" color={COLORS.background} />
            ) : (
              <Text style={styles.sendIcon}>➤</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  header: {
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderGold,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarGradient: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  avatarIcon: {
    fontSize: 22,
    color: COLORS.background,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#7fae8a',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: FONTS.heading,
    fontSize: 18,
    color: COLORS.text,
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#7fae8a',
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: COLORS.textSecondary,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 22,
    paddingTop: 18,
    gap: 12,
    paddingBottom: 20,
  },
  messageWrapper: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  messageWrapperUser: {
    justifyContent: 'flex-end',
  },
  messageWrapperConcierge: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '78%',
    padding: 12,
    paddingHorizontal: 15,
    borderRadius: 14,
  },
  messageBubbleUser: {
    borderBottomRightRadius: 3,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  messageBubbleConcierge: {
    backgroundColor: COLORS.backgroundCard,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderBottomLeftRadius: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  messageTextUser: {
    fontSize: 12.5,
    lineHeight: 18.75,
    color: COLORS.background,
  },
  messageTextConcierge: {
    fontSize: 12.5,
    lineHeight: 18.75,
    color: COLORS.text,
  },
  timestamp: {
    fontSize: 9,
    marginTop: 4,
  },
  timestampUser: {
    color: COLORS.backgroundCard,
    opacity: 0.7,
  },
  timestampConcierge: {
    color: COLORS.textTertiary,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  statusIndicator: {
    marginLeft: 6,
  },
  statusIcon: {
    fontSize: 10,
    color: COLORS.backgroundCard,
    opacity: 0.8,
  },
  statusIconError: {
    fontSize: 9,
    color: '#ff6b6b',
    fontWeight: '600',
  },
  attachmentImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
    marginBottom: 8,
  },
  downloadBadge: {
    position: 'absolute',
    bottom: 14,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  downloadText: {
    color: COLORS.background,
    fontSize: 10,
  },
  documentAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  documentIcon: {
    fontSize: 32,
    marginRight: 10,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '600',
    marginBottom: 2,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: 30,
  },
  emptyIconContainer: {
    marginBottom: 24,
  },
  emptyIconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(200, 164, 93, 0.3)',
  },
  emptyIcon: {
    fontSize: 32,
    color: COLORS.primary,
  },
  emptyText: {
    fontSize: 18,
    color: COLORS.text,
    fontFamily: FONTS.heading,
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  emptyFeatures: {
    marginTop: 28,
    gap: 12,
    alignItems: 'center',
  },
  featureItem: {
    fontSize: 12,
    color: COLORS.textTertiary,
    letterSpacing: 0.3,
  },
  attachmentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.backgroundCard,
    padding: 12,
    marginHorizontal: 22,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  previewContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  previewImage: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginRight: 10,
  },
  previewIcon: {
    fontSize: 32,
    marginRight: 10,
  },
  previewName: {
    fontSize: 12,
    color: COLORS.text,
    flex: 1,
  },
  removeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.error,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  removeButtonText: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: 'bold',
  },
  chipsContainer: {
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderGold,
    backgroundColor: COLORS.background,
  },
  chipsLabel: {
    fontSize: 10,
    letterSpacing: 2,
    color: COLORS.textTertiary,
    marginBottom: 12,
    fontWeight: '600',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(200, 164, 93, 0.3)',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  chipText: {
    color: COLORS.primary,
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    paddingHorizontal: 22,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderGold,
    backgroundColor: COLORS.background,
    gap: 12,
  },
  attachButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.backgroundCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  attachIcon: {
    fontSize: 19,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 11,
    fontSize: 13.5,
    color: COLORS.text,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  sendIcon: {
    fontSize: 19,
    color: COLORS.background,
    fontWeight: 'bold',
  },
  errorAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ff6b6b',
    gap: 10,
  },
  errorIcon: {
    fontSize: 32,
  },
  errorText: {
    fontSize: 12,
    color: '#ff6b6b',
    fontWeight: '600',
  },
});
