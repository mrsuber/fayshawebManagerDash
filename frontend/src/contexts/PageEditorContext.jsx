import React, { createContext, useState, useContext, useCallback } from 'react';
import axios from 'axios';

const PageEditorContext = createContext();

export const usePageEditor = () => {
  const context = useContext(PageEditorContext);
  // Return null instead of throwing error - let components handle it gracefully
  return context;
};

export const PageEditorProvider = ({ children }) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [currentPage, setCurrentPage] = useState('home');
  const [pageContent, setPageContent] = useState({});
  const [pendingChanges, setPendingChanges] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // API Base URL - use relative path in production, localhost in development
  const API_URL = process.env.REACT_APP_API_URL ||
    (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
      ? '/api'
      : 'http://localhost:5001/api');

  // Fetch content for current page and language
  const fetchPageContent = useCallback(async (pageId, language) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/pages/${pageId}/${language}`);

      if (response.data.success && response.data.content) {
        setPageContent(response.data.content);
        setCurrentPage(pageId);
        setCurrentLanguage(language);
      }
    } catch (error) {
      console.error('Error fetching page content:', error);
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  // Update a single content field
  const updateContentField = useCallback((section, key, value) => {
    const changeKey = `${section}.${key}`;
    setPendingChanges(prev => ({
      ...prev,
      [changeKey]: { section, key, value }
    }));

    // Update local state immediately for UI feedback
    setPageContent(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  }, []);

  // Get content value by section and key
  const getContentValue = useCallback((section, key, defaultValue = '') => {
    return pageContent?.[section]?.[key] || defaultValue;
  }, [pageContent]);

  // Save all pending changes to backend
  const saveChanges = useCallback(async () => {
    try {
      setSaving(true);

      // Convert pending changes back to the expected format
      const contentToSave = {};
      Object.values(pendingChanges).forEach(({ section, key, value }) => {
        if (!contentToSave[section]) {
          contentToSave[section] = { ...pageContent[section] };
        }
        contentToSave[section][key] = value;
      });

      const response = await axios.post(
        `${API_URL}/pages/${currentPage}/${currentLanguage}`,
        { content: contentToSave }
      );

      if (response.data.success) {
        setPendingChanges({});
        return { success: true };
      }

      return { success: false, error: 'Failed to save changes' };
    } catch (error) {
      console.error('Error saving changes:', error);
      return { success: false, error: error.response?.data?.error || 'Failed to save changes' };
    } finally {
      setSaving(false);
    }
  }, [pendingChanges, currentPage, currentLanguage, pageContent, API_URL]);

  // Cancel all pending changes
  const cancelChanges = useCallback(() => {
    setPendingChanges({});
    fetchPageContent(currentPage, currentLanguage);
  }, [currentPage, currentLanguage, fetchPageContent]);

  // Check if there are unsaved changes
  const hasUnsavedChanges = useCallback(() => {
    return Object.keys(pendingChanges).length > 0;
  }, [pendingChanges]);

  const value = {
    isEditMode,
    setIsEditMode,
    currentLanguage,
    setCurrentLanguage,
    currentPage,
    setCurrentPage,
    pageContent,
    loading,
    saving,
    fetchPageContent,
    updateContentField,
    getContentValue,
    saveChanges,
    cancelChanges,
    hasUnsavedChanges,
    pendingChanges
  };

  return (
    <PageEditorContext.Provider value={value}>
      {children}
    </PageEditorContext.Provider>
  );
};

export default PageEditorContext;
