import React, { useEffect } from 'react';
import { usePageEditor } from '../contexts/PageEditorContext';

const VisualPageEditor = ({ pageId, children }) => {
  const {
    isEditMode,
    setIsEditMode,
    currentLanguage,
    setCurrentLanguage,
    fetchPageContent,
    saveChanges,
    cancelChanges,
    hasUnsavedChanges,
    saving
  } = usePageEditor();

  useEffect(() => {
    // Fetch content when page or language changes
    fetchPageContent(pageId, currentLanguage);
  }, [pageId, currentLanguage, fetchPageContent]);

  const handleSave = async () => {
    const result = await saveChanges();
    if (result.success) {
      setIsEditMode(false);
      alert('Changes saved successfully!');
    } else {
      alert('Failed to save changes: ' + result.error);
    }
  };

  const handleCancel = () => {
    if (hasUnsavedChanges()) {
      if (window.confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        cancelChanges();
        setIsEditMode(false);
      }
    } else {
      setIsEditMode(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Editor Toolbar */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Left section - Title */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Visual Page Editor - {pageId.charAt(0).toUpperCase() + pageId.slice(1)}
              </h2>
              {isEditMode && hasUnsavedChanges() && (
                <p className="text-sm text-orange-600 mt-1">
                  ● You have unsaved changes
                </p>
              )}
            </div>

            {/* Right section - Controls */}
            <div className="flex items-center space-x-4">
              {/* Language Toggle */}
              <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setCurrentLanguage('en')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    currentLanguage === 'en'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  🇬🇧 English
                </button>
                <button
                  onClick={() => setCurrentLanguage('fr')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    currentLanguage === 'fr'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  🇫🇷 French
                </button>
              </div>

              {/* Edit Mode Toggle */}
              {!isEditMode ? (
                <button
                  onClick={() => setIsEditMode(true)}
                  className="flex items-center space-x-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  <span>Enable Editing</span>
                </button>
              ) : (
                <div className="flex space-x-2">
                  <button
                    onClick={handleCancel}
                    className="flex items-center space-x-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold px-6 py-2 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span>Cancel</span>
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !hasUnsavedChanges()}
                    className="flex items-center space-x-2 bg-green-500 hover:bg-green-600 text-white font-semibold px-6 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <>
                        <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Info Banner when in edit mode */}
          {isEditMode && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
              <div className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900">Edit Mode Active</p>
                  <p className="text-xs text-blue-700 mt-1">
                    Hover over any text element to see the edit icon. Click the pencil icon to edit inline.
                    Press Enter to save, Escape to cancel, or use the buttons above to save/cancel all changes.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Page Content */}
      <div className="min-h-screen">
        {children}
      </div>
    </div>
  );
};

export default VisualPageEditor;
