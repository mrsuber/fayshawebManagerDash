import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../../contexts/AuthContext';

// Component for rendering image attachment with error handling
const ImageAttachment = ({ attachment, isUserMessage }) => {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Get URL from attachment
  let url = attachment.url || attachment.uri;

  // Handle different URL types
  let fullUrl;
  if (url?.startsWith('http') || url?.startsWith('data:') || url?.startsWith('file://')) {
    fullUrl = url;
  } else if (url?.startsWith('/')) {
    fullUrl = `${window.location.origin}${url}`;
  } else if (url) {
    fullUrl = `${window.location.origin}/${url}`;
  }

  if (!fullUrl) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚠️</span>
          <span className="text-sm text-red-700 font-medium">Attachment unavailable</span>
        </div>
      </div>
    );
  }

  if (imageError) {
    return (
      <div
        className="bg-red-50 border border-red-300 rounded-lg p-4 mb-2 cursor-pointer hover:bg-red-100 transition-colors"
        onClick={() => window.open(fullUrl, '_blank')}
      >
        <div className="flex items-center gap-3">
          <span className="text-3xl">🖼️</span>
          <div>
            <p className="text-sm font-semibold text-red-700">Image failed to load</p>
            <p className="text-xs text-red-600 mt-1">Click to view in new tab</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-2 relative group">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      )}
      <img
        src={fullUrl}
        alt={attachment.name || 'attachment'}
        className={`max-w-full max-h-80 rounded-lg cursor-pointer shadow-md hover:shadow-lg transition-shadow ${isLoading ? 'opacity-0' : 'opacity-100'}`}
        onClick={() => window.open(fullUrl, '_blank')}
        onLoad={() => setIsLoading(false)}
        onError={(e) => {
          console.error('Failed to load image:', fullUrl);
          setImageError(true);
          setIsLoading(false);
        }}
      />
      {!isLoading && !imageError && (
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <a
            href={fullUrl}
            download={attachment.name || 'image.jpg'}
            className="bg-black bg-opacity-70 hover:bg-opacity-90 text-white px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download
          </a>
        </div>
      )}
    </div>
  );
};

// Component for rendering document attachment
const DocumentAttachment = ({ attachment, isUserMessage }) => {
  const url = attachment.url || attachment.uri;

  // Get file extension
  const fileName = attachment.name || 'document';
  const extension = fileName.split('.').pop()?.toUpperCase() || 'FILE';

  // Determine icon based on file type
  const getFileIcon = () => {
    if (attachment.mimeType?.includes('pdf') || extension === 'PDF') return '📄';
    if (attachment.mimeType?.includes('word') || extension === 'DOC' || extension === 'DOCX') return '📝';
    if (attachment.mimeType?.includes('excel') || extension === 'XLS' || extension === 'XLSX') return '📊';
    return '📎';
  };

  return (
    <div
      className={`mb-2 border rounded-lg p-3 cursor-pointer transition-all hover:shadow-md ${
        isUserMessage
          ? 'bg-white border-gray-300 hover:border-gray-400'
          : 'bg-white bg-opacity-20 border-white border-opacity-30 hover:bg-opacity-30'
      }`}
      onClick={() => window.open(url, '_blank')}
    >
      <div className="flex items-center gap-3">
        <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${
          isUserMessage ? 'bg-gray-100' : 'bg-white bg-opacity-20'
        }`}>
          <span className="text-2xl">{getFileIcon()}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${
            isUserMessage ? 'text-gray-900' : 'text-white'
          }`}>
            {fileName}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs font-semibold ${
              isUserMessage ? 'text-gray-600' : 'text-white text-opacity-80'
            }`}>
              {extension}
            </span>
            <span className={`text-xs ${
              isUserMessage ? 'text-gray-500' : 'text-white text-opacity-70'
            }`}>
              • Click to download
            </span>
          </div>
        </div>
        <div className="flex-shrink-0">
          <svg className={`w-5 h-5 ${isUserMessage ? 'text-gray-400' : 'text-white text-opacity-70'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </div>
      </div>
    </div>
  );
};

const WellnessConcierge = () => {
  const { token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [attachedFile, setAttachedFile] = useState(null);
  const fileInputRef = useRef(null);
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch('/api/wellness/admin/concierge/messages', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      const data = await response.json();
      console.log('Fetched messages:', data.messages?.length, 'messages');
      if (data.success) {
        // Sort messages by created_at ascending (oldest first) for proper display
        const sortedMessages = data.messages.sort((a, b) =>
          new Date(a.created_at) - new Date(b.created_at)
        );
        setMessages(sortedMessages);
        // Scroll to bottom after messages are updated
        setTimeout(scrollToBottom, 100);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  }, [token, scrollToBottom]);

  // Socket.IO connection
  useEffect(() => {
    if (!token) return;

    const socket = io(window.location.origin, {
      auth: { token }, // the server only lets staff join the admin room
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Admin socket connected');
      // Join admin room
      socket.emit('joinAdmin');
    });

    socket.on('new_message', (message) => {
      console.log('New message received via socket:', message);
      console.log('Triggering message refresh...');
      // Refresh messages to get complete data with user info
      fetchMessages();
    });

    socket.on('disconnect', () => {
      console.log('Admin socket disconnected');
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    return () => {
      socket.disconnect();
    };
  }, [token, fetchMessages]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Update selectedUser when messages change to ensure UI updates
  useEffect(() => {
    if (selectedUser && messages.length > 0) {
      // Find the updated conversation for the currently selected user
      const updatedConversation = Object.values(
        messages.reduce((acc, msg) => {
          if (!acc[msg.user_id]) {
            acc[msg.user_id] = {
              user_id: msg.user_id,
              user_name: msg.user_name,
              user_email: msg.user_email,
              messages: [],
              lastMessage: msg.created_at,
              unreadCount: msg.is_from_guest && !msg.is_read ? 1 : 0
            };
          }
          acc[msg.user_id].messages.push(msg);
          if (msg.is_from_guest && !msg.is_read) {
            acc[msg.user_id].unreadCount++;
          }
          if (new Date(msg.created_at) > new Date(acc[msg.user_id].lastMessage)) {
            acc[msg.user_id].lastMessage = msg.created_at;
          }
          return acc;
        }, {})
      ).find(conv => conv.user_id === selectedUser.user_id);

      if (updatedConversation) {
        console.log('Updating selected user with', updatedConversation.messages.length, 'messages');
        setSelectedUser(updatedConversation);
        setTimeout(scrollToBottom, 100);
      }
    }
  }, [messages, scrollToBottom]);

  // Scroll to bottom when selected user changes
  useEffect(() => {
    if (selectedUser) {
      setTimeout(scrollToBottom, 100);
    }
  }, [selectedUser?.user_id]);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Convert file to base64 or create URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachedFile({
          name: file.name,
          type: file.type,
          uri: reader.result,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeAttachment = () => {
    setAttachedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const sendReply = async () => {
    if ((!replyMessage.trim() && !attachedFile) || !selectedUser) return;

    try {
      const metadata = { auto: false };

      if (attachedFile) {
        metadata.attachment = {
          type: attachedFile.type.startsWith('image/') ? 'image' : 'document',
          uri: attachedFile.uri,
          name: attachedFile.name,
          mimeType: attachedFile.type,
        };
      }

      const response = await fetch('/api/wellness/admin/concierge/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: selectedUser.user_id,
          message: replyMessage.trim() || '📎 Sent an attachment',
          metadata
        })
      });

      const data = await response.json();

      if (data.success) {
        // Add message to the current conversation
        setMessages(prev => [...prev, data.message]);
        setReplyMessage('');
        setAttachedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        // Refresh to update the conversation
        fetchMessages();
      }
    } catch (error) {
      console.error('Error sending reply:', error);
      alert('Failed to send message');
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  // Group messages by user
  const groupedMessages = messages.reduce((acc, msg) => {
    if (!acc[msg.user_id]) {
      acc[msg.user_id] = {
        user_id: msg.user_id,
        user_name: msg.user_name,
        user_email: msg.user_email,
        messages: [],
        lastMessage: msg.created_at,
        unreadCount: msg.is_from_guest && !msg.is_read ? 1 : 0
      };
    }
    acc[msg.user_id].messages.push(msg);
    if (msg.is_from_guest && !msg.is_read) {
      acc[msg.user_id].unreadCount++;
    }
    if (new Date(msg.created_at) > new Date(acc[msg.user_id].lastMessage)) {
      acc[msg.user_id].lastMessage = msg.created_at;
    }
    return acc;
  }, {});

  const userConversations = Object.values(groupedMessages).sort(
    (a, b) => new Date(b.lastMessage) - new Date(a.lastMessage)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-heading text-gray-900">Concierge Messages</h1>
        <p className="text-gray-600 mt-1">Monitor and respond to guest wellness requests</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="text-2xl font-bold text-blue-800">
            {userConversations.length}
          </div>
          <div className="text-sm text-blue-600 mt-1">Active Conversations</div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
          <div className="text-2xl font-bold text-purple-800">
            {messages.length}
          </div>
          <div className="text-sm text-purple-600 mt-1">Total Messages</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="text-2xl font-bold text-red-800">
            {userConversations.reduce((sum, conv) => sum + conv.unreadCount, 0)}
          </div>
          <div className="text-sm text-red-600 mt-1">Unread Messages</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversations List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="bg-primary-600 text-white px-6 py-4">
              <h2 className="text-lg font-semibold">Conversations</h2>
              <p className="text-sm text-primary-100 mt-1">
                {userConversations.reduce((sum, conv) => sum + conv.unreadCount, 0)} unread
              </p>
            </div>

            <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
              {userConversations.map(conv => (
                <div
                  key={conv.user_id}
                  onClick={() => setSelectedUser(conv)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedUser?.user_id === conv.user_id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <h3 className="font-semibold text-gray-900">{conv.user_name}</h3>
                        {conv.unreadCount > 0 && (
                          <span className="ml-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 truncate mt-1">
                        {conv.messages[conv.messages.length - 1].message}
                      </p>
                    </div>
                    <span className="text-xs text-gray-500 ml-2">
                      {formatTimestamp(conv.lastMessage)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {userConversations.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                <p>No messages yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Message Thread */}
        <div className="lg:col-span-2">
          {selectedUser ? (
            <div className="bg-white rounded-xl shadow-lg overflow-hidden flex flex-col h-[700px]">
              {/* Header */}
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">{selectedUser.user_name}</h2>
                <p className="text-sm text-gray-600">{selectedUser.user_email}</p>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {selectedUser.messages.map(msg => {
                  const isUserMessage = msg.sender_type === 'user';
                  const isAI = msg.sender_type === 'concierge' && msg.metadata?.auto;

                  // Parse metadata if it's a string
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
                    <div
                      key={msg.id}
                      className={`flex ${isUserMessage ? 'justify-start' : 'justify-end'}`}
                    >
                      <div className="max-w-[70%]">
                        {!isUserMessage && (
                          <div className="text-xs text-gray-500 mb-1 text-right">
                            {isAI ? '🤖 AI Assistant' : '👤 Concierge'}
                          </div>
                        )}
                        <div
                          className={`rounded-lg px-4 py-3 ${
                            isUserMessage
                              ? 'bg-gray-100 text-gray-900'
                              : isAI
                              ? 'bg-blue-100 text-blue-900'
                              : 'bg-primary-600 text-white'
                          }`}
                        >
                          {/* Render attachment using new components */}
                          {metadata?.attachment && (
                            <>
                              {metadata.attachment.type === 'image' ? (
                                <ImageAttachment
                                  attachment={metadata.attachment}
                                  isUserMessage={isUserMessage}
                                />
                              ) : (
                                <DocumentAttachment
                                  attachment={metadata.attachment}
                                  isUserMessage={isUserMessage}
                                />
                              )}
                            </>
                          )}

                          {/* Only show message text if it's not just the attachment placeholder */}
                          {msg.message && !msg.message.includes('📎 Sent an attachment') && (
                            <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                          )}
                          <p className={`text-xs mt-2 ${
                            isUserMessage ? 'text-gray-500' : isAI ? 'text-blue-600' : 'text-primary-100'
                          }`}>
                            {formatTimestamp(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply Box */}
              <div className="border-t border-gray-200 p-4 bg-gray-50">
                {/* Attachment Preview */}
                {attachedFile && (
                  <div className="mb-3 p-4 bg-white border border-gray-300 rounded-lg shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {attachedFile.type.startsWith('image/') ? (
                          <div className="flex-shrink-0">
                            <img
                              src={attachedFile.uri}
                              alt="Preview"
                              className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                            />
                          </div>
                        ) : (
                          <div className="flex-shrink-0 w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
                            <span className="text-3xl">📎</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {attachedFile.name}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {attachedFile.type.startsWith('image/') ? 'Image' : 'Document'} • Ready to send
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={removeAttachment}
                        className="flex-shrink-0 w-8 h-8 bg-red-100 hover:bg-red-200 text-red-600 rounded-full flex items-center justify-center transition-colors"
                        title="Remove attachment"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  {/* Hidden file input */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="image/*,application/pdf,.doc,.docx"
                    className="hidden"
                  />

                  {/* Attachment button */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-shrink-0 w-10 h-10 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 hover:border-gray-400 transition-all flex items-center justify-center group"
                    title="Attach file"
                  >
                    <svg className="w-5 h-5 text-gray-600 group-hover:text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </button>

                  <input
                    type="text"
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder="Type your reply..."
                    className="flex-1 px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && (replyMessage.trim() || attachedFile)) {
                        sendReply();
                      }
                    }}
                  />
                  <button
                    onClick={sendReply}
                    disabled={!replyMessage.trim() && !attachedFile}
                    className="flex-shrink-0 bg-primary-600 text-white px-6 py-2.5 rounded-lg hover:bg-primary-700 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm hover:shadow-md"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Send
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-lg h-[700px] flex items-center justify-center">
              <div className="text-center text-gray-500">
                <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-lg">Select a conversation to view messages</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WellnessConcierge;
