// frontend/src/components/common/FileUpload.jsx
import React, { useState, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { 
  DocumentArrowUpIcon, 
  XMarkIcon, 
  DocumentTextIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { uploadDocument } from '../../services/api';

const FileUpload = ({ onUploadSuccess }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [files, setFiles] = useState([]);
  const fileInputRef = useRef(null);

  const supportedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/html',
    'text/plain',
    'application/json',
  ];

  const fileExtensions = {
    'application/pdf': 'PDF',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'text/html': 'HTML',
    'text/plain': 'TXT',
    'application/json': 'JSON',
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const validateFile = (file) => {
    if (!supportedTypes.includes(file.type)) {
      toast.error(`Unsupported file type: ${file.type}. Please upload PDF, DOCX, HTML, TXT, or JSON.`);
      return false;
    }
    if (file.size > 16 * 1024 * 1024) {
      toast.error('File size exceeds the 16MB limit.');
      return false;
    }
    return true;
  };

  const processFiles = (newFiles) => {
    const validFiles = Array.from(newFiles).filter(validateFile);
    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles]);
    }
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  };

  const handleFileSelect = (e) => {
    processFiles(e.target.files);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index) => {
    const newFiles = [...files];
    newFiles.splice(index, 1);
    setFiles(newFiles);
    
    // Also remove from progress tracking
    const newProgress = { ...uploadProgress };
    delete newProgress[index];
    setUploadProgress(newProgress);
  };

  const uploadFiles = async () => {
    if (files.length === 0) {
      toast.error('Please select files to upload.');
      return;
    }
    
    setUploading(true);
    let uploadedDocuments = [];
    
    try {
      // Upload files one by one to better track progress
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Skip already uploaded files
        if (uploadProgress[i] === 100) continue;
        
        try {
          // Set initial progress
          setUploadProgress(prev => ({
            ...prev,
            [i]: 0
          }));
          
          // Simulate progress during upload (real progress would require backend support)
          const progressInterval = setInterval(() => {
            setUploadProgress(prev => {
              const currentProgress = prev[i] || 0;
              if (currentProgress < 90) {  // Go up to 90%, the last 10% when complete
                return {
                  ...prev,
                  [i]: currentProgress + Math.floor(Math.random() * 10) + 1
                };
              }
              return prev;
            });
          }, 300);
          
          // Upload the file
          const response = await uploadDocument(file);
          clearInterval(progressInterval);
          
          // Set complete progress
          setUploadProgress(prev => ({
            ...prev,
            [i]: 100
          }));
          
          // Add to successfully uploaded documents
          uploadedDocuments.push(response);
        } catch (error) {
          console.error(`Error uploading ${file.name}:`, error);
          toast.error(`Failed to upload ${file.name}`);
          
          // Mark as failed in progress
          setUploadProgress(prev => ({
            ...prev,
            [i]: -1  // -1 indicates failure
          }));
        }
      }
      
      // If we have successful uploads, notify parent component
      if (uploadedDocuments.length > 0) {
        toast.success(`Successfully uploaded ${uploadedDocuments.length} file(s).`);
        
        // Call the callback passed from parent
        if (onUploadSuccess) {
          onUploadSuccess(uploadedDocuments);
        }
        
        // Remove successfully uploaded files from the list
        const remainingFiles = files.filter((_, index) => uploadProgress[index] !== 100);
        setFiles(remainingFiles);
        
        // Reset progress for remaining files
        const newProgress = {};
        remainingFiles.forEach((_, index) => {
          newProgress[index] = uploadProgress[files.findIndex((f, i) => files[i] === remainingFiles[index])];
        });
        setUploadProgress(newProgress);
      }
    } catch (error) {
      toast.error('An error occurred while uploading files.');
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
    }
  };

  const getProgressColor = (progress) => {
    if (progress === -1) return 'bg-red-500';  // Error
    if (progress === 100) return 'bg-green-500';  // Complete
    return 'bg-blue-500';  // In progress
  };

  return (
    <div className="space-y-3">
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleFileDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
          }
        `}
      >
        <DocumentArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-2 text-sm text-gray-600">
          <span className="font-medium text-blue-600 hover:text-blue-500">
            Click to upload
          </span>{' '}
          or drag and drop
        </p>
        <p className="mt-1 text-xs text-gray-500">
          PDF, DOCX, HTML, TXT, JSON (max 16MB)
        </p>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          onChange={handleFileSelect}
          accept=".pdf,.docx,.html,.txt,.json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/html,text/plain,application/json"
        />
      </div>
      
      {files.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Selected files</h4>
          <ul className="space-y-3 max-h-48 overflow-y-auto">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`} className="relative bg-gray-50 rounded-md">
                <div className="flex items-center justify-between px-3 py-2 text-sm">
                  <div className="flex items-center max-w-xs">
                    <DocumentTextIcon className="h-5 w-5 text-gray-400 mr-2" />
                    <span className="text-gray-800 font-medium truncate">
                      {file.name}
                    </span>
                    <span className="ml-2 text-xs text-gray-500 flex-shrink-0">
                      ({fileExtensions[file.type] || 'Unknown'})
                    </span>
                  </div>
                  
                  <div className="flex items-center">
                    {uploadProgress[index] !== undefined && (
                      <div className="mr-3 text-xs font-medium">
                        {uploadProgress[index] === -1 ? (
                          <span className="text-red-500">Failed</span>
                        ) : uploadProgress[index] === 100 ? (
                          <span className="text-green-500">Completed</span>
                        ) : (
                          <span>{uploadProgress[index]}%</span>
                        )}
                      </div>
                    )}
                    
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(index);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                
                {/* Progress bar */}
                {uploadProgress[index] !== undefined && (
                  <div className="h-1 w-full bg-gray-200 absolute bottom-0 left-0 rounded-b-md overflow-hidden">
                    <div 
                      className={`h-full ${getProgressColor(uploadProgress[index])}`}
                      style={{ width: `${uploadProgress[index] === -1 ? 100 : uploadProgress[index]}%` }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
          
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              uploadFiles();
            }}
            disabled={uploading || files.length === 0}
            className={`
              mt-3 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm 
              text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 
              focus:ring-offset-2 focus:ring-blue-500 w-full flex items-center justify-center
              ${(uploading || files.length === 0) && 'opacity-75 cursor-not-allowed'}
            `}
          >
            {uploading ? (
              <>
                <ArrowPathIcon className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" />
                Uploading...
              </>
            ) : (
              `Upload ${files.length} file${files.length !== 1 ? 's' : ''}`
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default FileUpload;