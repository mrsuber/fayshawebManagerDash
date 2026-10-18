// Notification Service - Firebase Cloud Messaging
const { getMessaging } = require('../config/firebase');

/**
 * Send push notification to a single device
 * @param {string} token - FCM token
 * @param {object} notification - Notification payload
 * @param {object} data - Optional data payload
 * @returns {Promise<object>} Result object
 */
const sendNotificationToDevice = async (token, notification, data = {}) => {
  try {
    const messaging = getMessaging();

    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
        ...(notification.icon && { icon: notification.icon }),
        ...(notification.image && { image: notification.image })
      },
      data: {
        ...data,
        clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        timestamp: Date.now().toString()
      },
      token
    };

    const response = await messaging.send(message);
    console.log('✓ Notification sent successfully:', response);

    return {
      success: true,
      messageId: response
    };
  } catch (error) {
    console.error('❌ Error sending notification:', error);

    // Handle specific FCM errors
    if (error.code === 'messaging/registration-token-not-registered') {
      console.log('Token is no longer valid, should be removed from database');
      return {
        success: false,
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      };
    }

    return {
      success: false,
      error: error.message,
      code: error.code
    };
  }
};

/**
 * Send push notification to multiple devices
 * @param {Array<string>} tokens - Array of FCM tokens
 * @param {object} notification - Notification payload
 * @param {object} data - Optional data payload
 * @returns {Promise<object>} Result object
 */
const sendNotificationToMultipleDevices = async (tokens, notification, data = {}) => {
  try {
    if (!tokens || tokens.length === 0) {
      return {
        success: false,
        error: 'No tokens provided'
      };
    }

    const messaging = getMessaging();

    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
        ...(notification.icon && { icon: notification.icon }),
        ...(notification.image && { image: notification.image })
      },
      data: {
        ...data,
        clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        timestamp: Date.now().toString()
      },
      tokens
    };

    const response = await messaging.sendEachForMulticast(message);

    console.log(`✓ Notifications sent: ${response.successCount} successful, ${response.failureCount} failed`);

    // Log failed tokens
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`Failed to send to token ${tokens[idx]}:`, resp.error);
        }
      });
    }

    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      responses: response.responses.map((resp, idx) => ({
        token: tokens[idx],
        success: resp.success,
        messageId: resp.messageId,
        error: resp.error?.message
      }))
    };
  } catch (error) {
    console.error('❌ Error sending multicast notification:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send notification to a topic (broadcast)
 * @param {string} topic - Topic name
 * @param {object} notification - Notification payload
 * @param {object} data - Optional data payload
 * @returns {Promise<object>} Result object
 */
const sendNotificationToTopic = async (topic, notification, data = {}) => {
  try {
    const messaging = getMessaging();

    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
        ...(notification.icon && { icon: notification.icon }),
        ...(notification.image && { image: notification.image })
      },
      data: {
        ...data,
        clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        timestamp: Date.now().toString()
      },
      topic
    };

    const response = await messaging.send(message);
    console.log(`✓ Topic notification sent to "${topic}":`, response);

    return {
      success: true,
      messageId: response
    };
  } catch (error) {
    console.error('❌ Error sending topic notification:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Subscribe tokens to a topic
 * @param {Array<string>} tokens - FCM tokens
 * @param {string} topic - Topic name
 * @returns {Promise<object>} Result object
 */
const subscribeToTopic = async (tokens, topic) => {
  try {
    const messaging = getMessaging();
    const response = await messaging.subscribeToTopic(tokens, topic);

    console.log(`✓ Subscribed ${response.successCount} tokens to topic "${topic}"`);

    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount
    };
  } catch (error) {
    console.error('❌ Error subscribing to topic:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Unsubscribe tokens from a topic
 * @param {Array<string>} tokens - FCM tokens
 * @param {string} topic - Topic name
 * @returns {Promise<object>} Result object
 */
const unsubscribeFromTopic = async (tokens, topic) => {
  try {
    const messaging = getMessaging();
    const response = await messaging.unsubscribeFromTopic(tokens, topic);

    console.log(`✓ Unsubscribed ${response.successCount} tokens from topic "${topic}"`);

    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount
    };
  } catch (error) {
    console.error('❌ Error unsubscribing from topic:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send custom data-only message (no notification)
 * @param {string} token - FCM token
 * @param {object} data - Data payload
 * @returns {Promise<object>} Result object
 */
const sendDataMessage = async (token, data) => {
  try {
    const messaging = getMessaging();

    const message = {
      data: {
        ...data,
        timestamp: Date.now().toString()
      },
      token
    };

    const response = await messaging.send(message);
    console.log('✓ Data message sent:', response);

    return {
      success: true,
      messageId: response
    };
  } catch (error) {
    console.error('❌ Error sending data message:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  sendNotificationToDevice,
  sendNotificationToMultipleDevices,
  sendNotificationToTopic,
  subscribeToTopic,
  unsubscribeFromTopic,
  sendDataMessage
};
