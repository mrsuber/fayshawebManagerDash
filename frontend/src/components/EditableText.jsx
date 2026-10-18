import React, { useState, useRef, useEffect } from 'react';
import { usePageEditor } from '../contexts/PageEditorContext';

const EditableText = ({
  section,
  contentKey,
  defaultValue = '',
  as = 'span',
  className = '',
  multiline = false,
  children
}) => {
  // Get the page editor context (will be null if not in editor)
  const pageEditorContext = usePageEditor();

  const isEditMode = pageEditorContext?.isEditMode || false;
  const getContentValue = pageEditorContext?.getContentValue || (() => defaultValue);
  const updateContentField = pageEditorContext?.updateContentField || (() => {});

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef(null);

  // Get the actual content value
  const contentValue = getContentValue(section, contentKey, defaultValue);

  // Use children if provided, otherwise use content value
  const displayValue = children || contentValue;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      // Select all text for easier editing
      if (inputRef.current.select) {
        inputRef.current.select();
      }
    }
  }, [isEditing]);

  const handleEditClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setEditValue(contentValue);
    setIsEditing(true);
  };

  const handleSave = () => {
    if (editValue.trim() !== contentValue) {
      updateContentField(section, contentKey, editValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(contentValue);
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !multiline && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  // If not in edit mode, just render the content
  if (!isEditMode) {
    const Component = as;
    return <Component className={className}>{displayValue}</Component>;
  }

  // In edit mode but not currently editing - show content with edit icon
  if (!isEditing) {
    const Component = as;
    return (
      <span className="relative inline-block group">
        <Component className={className}>{displayValue}</Component>
        <button
          onClick={handleEditClick}
          className="ml-2 inline-flex items-center justify-center w-6 h-6 bg-primary-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          title="Edit this text"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      </span>
    );
  }

  // Currently editing - show inline editor
  return (
    <span className="relative inline-block">
      {multiline ? (
        <textarea
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="bg-white text-gray-900 border-2 border-primary-500 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-600 min-w-[200px] shadow-lg"
          rows={3}
          style={{ fontSize: 'inherit', fontFamily: 'inherit', fontWeight: 'inherit' }}
        />
      ) : (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="bg-white text-gray-900 border-2 border-primary-500 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-600 min-w-[200px] shadow-lg"
          style={{ fontSize: 'inherit', fontFamily: 'inherit', fontWeight: 'inherit' }}
        />
      )}
      <div className="absolute -right-20 top-0 flex space-x-1">
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="w-6 h-6 bg-green-500 text-white rounded-full hover:bg-green-600 flex items-center justify-center"
          title="Save"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </button>
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            handleCancel();
          }}
          className="w-6 h-6 bg-red-500 text-white rounded-full hover:bg-red-600 flex items-center justify-center"
          title="Cancel"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </span>
  );
};

export default EditableText;
