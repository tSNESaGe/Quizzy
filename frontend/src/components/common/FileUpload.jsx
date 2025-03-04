import React, { useState, useRef } from 'react';
import { 
  CloudArrowUpIcon, 
  XMarkIcon, 
  DocumentTextIcon,
  DocumentCheckIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { batchUploadDocuments, uploadDocument } from '../../services/api';
import { toast } from 'react-hot-toast';
import Button from './Button';
import crypto from 'crypto';

const FileUpload = ({ onUploadSuccess }) => {
  const [files, setFiles] = useState([]);
  const [processingFiles, setProcessingFiles] = useState([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const fileInputRef = useRef(null);

  // Function to calculate file hash
  const calculateFileHash = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const buffer = event.target.result;
        const hash = crypto.createHash('sha256');
        hash.update(buffer);
        resolve(hash.digest('hex'));
      };
      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    });
  };

  // Handle file selection
  const handleFileSelect = async (event) => {
    const selectedFiles = Array.from(event.target.files);
    
    // Calculate hashes for new files and check for duplicates
    const filesWithHashes = await Promise.all(
      selectedFiles.map(async (file) => ({
        file,
        hash: await calculateFileHash(file)
      }))
    );

    // Check for duplicates within the current selection
    const uniqueFiles = [];
    const duplicateFiles = [];
    
    filesWithHashes.forEach(({ file, hash }) => {
      const isDuplicateInCurrentSelection = uniqueFiles.some(
        existingFile => existingFile.hash === hash
      );
      
      if (!isDuplicateInCurrentSelection) {
        uniqueFiles.push({ file, hash });
      } else {
        duplicateFiles.push(file);
      }
    });

    // Show warning for duplicates in current selection
    if (duplicateFiles.length > 0) {
      toast.error(`${duplicateFiles.length} file(s) are duplicates within this upload`);
    }

    // Update files state with unique files
    setFiles(prev => [...prev, ...uniqueFiles]);
  };

  // Remove a file from selection
  const removeFile = (fileToRemove) => {
    setFiles(prev => prev.filter(({ file }) => file !== fileToRemove));
  };

  // Upload files
  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error('Please select files to upload');
      return;
    }

    try {
      // Reset processing states
      setProcessingFiles(files.map(({ file }) => ({ 
        file, 
        status: 'processing',
        hash: file.hash 
      })));
      setOverallProgress(0);

      // Batch upload files
      const filesToUpload = files.map(({ file }) => file);
      const uploadResponse = await batchUploadDocuments(
        filesToUpload, 
        true,  // create embeddings
        true   // skip duplicates
      );

      // Process upload response
      const processedFiles = uploadResponse.map(result => ({
        file: filesToUpload.find(f => f.name === result.filename),
        status: result.status,
        existingDocumentId: result.existing_document_id || null
      }));

      // Update processing files state
      setProcessingFiles(processedFiles);

      // Calculate overall progress
      const successCount = processedFiles.filter(f => f.status === 'uploaded').length;
      setOverallProgress((successCount / processedFiles.length) * 100);

      // Show toast notifications
      processedFiles.forEach(result => {
        if (result.status === 'uploaded') {
          toast.success(`${result.file.name} uploaded successfully`);
        } else if (result.status === 'duplicate') {
          toast.info(`${result.file.name} is a duplicate`, {
            duration: 5000,
            action: {
              text: 'View Existing',
              onClick: () => {
                // Implement navigation to existing document
                // You might want to pass the existing_document_id to a function
                console.log('Existing document ID:', result.existingDocumentId);
              }
            }
          });
        }
      });

      // Clear files and call success callback
      setFiles([]);
      fileInputRef.current.value = '';
      onUploadSuccess(processedFiles);

    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Error uploading files');
      setProcessingFiles([]);
      setOverallProgress(0);
    }
  };

  // Render file size in human-readable format
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="w-full">
      {/* File Input */}
      <div 
        className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center 
        hover:border-primary-500 transition duration-300"
      >
        <input 
          type="file" 
          multiple 
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
          id="file-upload"
        />
        <label 
          htmlFor="file-upload" 
          className="cursor-pointer flex flex-col items-center"
        >
          <CloudArrowUpIcon className="h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-600 mb-2">
            Drag and drop files or <span className="text-primary-600">browse</span>
          </p>
          <p className="text-xs text-gray-500">
            Supports PDF, DOCX, TXT, HTML, JSON (Max 50MB per file)
          </p>
        </label>
      </div>

      {/* Selected Files List */}
      {files.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Selected Files ({files.length})
          </h4>
          <ul className="space-y-2">
            {files.map(({ file, hash }) => (
              <li 
                key={hash} 
                className="flex items-center justify-between bg-gray-50 p-3 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <DocumentTextIcon className="h-6 w-6 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.size)} • {file.type || 'Unknown type'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => removeFile(file)}
                  className="text-red-500 hover:text-red-700"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Processing Files Indicator */}
      {processingFiles.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Processing Files
          </h4>
          <ul className="space-y-2">
            {processingFiles.map(({ file, status }) => (
              <li 
                key={file.name} 
                className="flex items-center justify-between bg-gray-50 p-3 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  {status === 'processing' ? (
                    <ArrowPathIcon className="h-6 w-6 text-blue-500 animate-spin" />
                  ) : status === 'uploaded' ? (
                    <DocumentCheckIcon className="h-6 w-6 text-green-500" />
                  ) : (
                    <DocumentTextIcon className="h-6 w-6 text-gray-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-800">{file.name}</p>
                    <p className="text-xs text-gray-500 capitalize">
                      {status}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Overall Progress */}
      {overallProgress > 0 && (
        <div className="mt-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Upload Progress</span>
            <span>{Math.round(overallProgress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-primary-600 h-2.5 rounded-full" 
              style={{ width: `${overallProgress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Upload Button */}
      {files.length > 0 && (
        <div className="mt-4 flex justify-end">
          <Button 
            onClick={handleUpload}
            className="w-full"
          >
            Upload {files.length} File{files.length !== 1 ? 's' : ''}
          </Button>
        </div>
      )}
    </div>
  );
};

export default FileUpload;