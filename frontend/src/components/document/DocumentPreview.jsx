// frontend/src/components/document/DocumentPreview.jsx
import React, { useState } from 'react';
import { 
  ArrowsPointingOutIcon, 
  ArrowsPointingInIcon,
  DocumentTextIcon,
  DocumentArrowDownIcon,
  ChatBubbleLeftEllipsisIcon
} from '@heroicons/react/24/outline';

const DocumentPreview = ({ document }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullContent, setShowFullContent] = useState(false);
  const [viewMode, setViewMode] = useState('preview'); // 'preview' or 'markdown'
  
  if (!document) {
    return <div>No document to preview</div>;
  }
  
  // Use the fields returned by preview endpoint:
  const contentPreview = document.content_preview || '';
  const fullContent = document.full_content || '';
  
  // Toggle view between short preview and full markdown view
  const toggleContentView = () => {
    setViewMode(viewMode === 'preview' ? 'markdown' : 'preview');
  };
  
  // Format date function (unchanged)
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Get file type styling (unchanged)
  const getFileTypeInfo = (fileType) => {
    const types = {
      'pdf': { icon: 'pdf', bgColor: 'bg-red-100', textColor: 'text-red-700' },
      'docx': { icon: 'docx', bgColor: 'bg-blue-100', textColor: 'text-blue-700' },
      'doc': { icon: 'doc', bgColor: 'bg-blue-100', textColor: 'text-blue-700' },
      'txt': { icon: 'txt', bgColor: 'bg-gray-100', textColor: 'text-gray-700' },
      'html': { icon: 'html', bgColor: 'bg-orange-100', textColor: 'text-orange-700' },
      'json': { icon: 'json', bgColor: 'bg-yellow-100', textColor: 'text-yellow-700' }
    };
    
    return types[fileType?.toLowerCase()] || { icon: 'file', bgColor: 'bg-gray-100', textColor: 'text-gray-700' };
  };
  
  const fileTypeInfo = getFileTypeInfo(document.file_type);
  
  const displayedContent = viewMode === 'preview'
    ? (showFullContent ? fullContent : contentPreview)
    : fullContent; // when viewing markdown, always show full content
  
  return (
    <div className={`bg-white rounded-lg shadow-md ${isFullscreen ? 'fixed inset-0 z-50 overflow-auto p-6' : ''}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <div className="flex items-center">
          <div className={`p-2 rounded-lg ${fileTypeInfo.bgColor} ${fileTypeInfo.textColor} mr-3`}>
            <DocumentTextIcon className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{document.filename}</h3>
            <p className="text-sm text-gray-500">
              {document.file_type.toUpperCase()} • Uploaded {formatDate(document.created_at)}
            </p>
          </div>
        </div>
        
        <div className="flex space-x-2">
          <button 
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-full"
            title={isFullscreen ? "Exit fullscreen" : "View fullscreen"}
          >
            {isFullscreen ? (
              <ArrowsPointingInIcon className="h-5 w-5" />
            ) : (
              <ArrowsPointingOutIcon className="h-5 w-5" />
            )}
          </button>
          <button 
            onClick={toggleContentView}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-full"
            title={`Switch to ${viewMode === 'preview' ? 'Markdown' : 'Preview'} view`}
          >
            <span className="text-sm">{viewMode === 'preview' ? 'Markdown' : 'Preview'}</span>
          </button>
          <button 
            onClick={() => {
              // Implement download functionality as needed
              alert('Download functionality would be implemented here');
            }}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-full"
            title="Download document"
          >
            <DocumentArrowDownIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4">
        <div className={`bg-gray-50 rounded-lg p-4 ${isFullscreen ? 'h-[calc(100vh-12rem)] overflow-auto' : 'max-h-96 overflow-auto'}`}>
          <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700">
            {displayedContent}
          </pre>
        </div>
        {viewMode === 'preview' && fullContent.length > contentPreview.length && !showFullContent && (
          <div className="mt-4 text-center">
            <button
              onClick={() => setShowFullContent(true)}
              className="px-4 py-2 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100"
            >
              Show full content
            </button>
          </div>
        )}
      </div>
      
      {/* Footer with additional info */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center">
          <ChatBubbleLeftEllipsisIcon className="h-5 w-5 text-gray-400 mr-2" />
          <p className="text-sm text-gray-600">
            {document.embeddings_created 
              ? "Document has embeddings for AI analysis" 
              : "Document doesn't have embeddings yet"}
          </p>
        </div>
      </div>
    </div>
  );
};

export default DocumentPreview;
