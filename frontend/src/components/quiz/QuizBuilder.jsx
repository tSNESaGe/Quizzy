// frontend/src/components/quiz/QuizBuilder.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { toast } from 'react-hot-toast';
import useAppStore from '../../store/appStore';
import { getDocuments } from '../../services/api';
import Button from '../common/Button';
import FileUpload from '../common/FileUpload';
import {
  DocumentTextIcon,
  DocumentPlusIcon,
  ArrowPathIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  CheckIcon,
  ExclamationCircleIcon,
  LightBulbIcon,
  PaperAirplaneIcon
} from '@heroicons/react/24/outline';

const QuizBuilder = ({ initialSelectedDocuments = [] }) => {
  const navigate = useNavigate();
  const {
    documents,
    setDocuments,
    fetchDocuments,
    generateQuiz,
    clearError,
    isGenerating,
    error
  } = useAppStore();

  // Multi-step form state
  const [currentStep, setCurrentStep] = useState(1);

  // Form state
  const [quizData, setQuizData] = useState({
    title: '',
    topic: '',
    num_questions: 10,
    document_ids: [],
    use_default_prompt: true,
    custom_prompt: '',
    use_embeddings: true
  });

  // UI state
  const [documentsExpanded, setDocumentsExpanded] = useState(true);
  const [uploadPanelExpanded, setUploadPanelExpanded] = useState(false);
  const [documentUploaded, setDocumentUploaded] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestedTopic, setSuggestedTopic] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  // Fetch documents on component mount
  useEffect(() => {
    const loadDocuments = async () => {
      const docs = await fetchDocuments();
      if (docs && docs.length > 0) {
        setDocumentsExpanded(true);
      } else {
        setUploadPanelExpanded(true);
      }
    };
    
    loadDocuments();
    clearError();
    
    return () => clearError();
  }, [fetchDocuments, clearError]);

  // Add this useEffect to handle initial document selection
  useEffect(() => {
    if (initialSelectedDocuments.length > 0) {
      setQuizData(prev => ({
        ...prev,
        document_ids: initialSelectedDocuments
      }));

      // Optional: Automatically expand documents section if pre-selected
      setDocumentsExpanded(true);
    }
  }, [initialSelectedDocuments]);
  // Helper function to check if a document is uploaded recently
  const isRecentlyUploaded = useCallback((doc) => {
    const now = new Date();
    const uploadTime = new Date(doc.created_at);
    const differenceInMinutes = (now - uploadTime) / (1000 * 60);
    return differenceInMinutes < 5; // Consider "recent" if uploaded within the last 5 minutes
  }, []);

  // Handle document selection
  const handleDocumentSelect = (docId) => {
    setQuizData(prev => {
      const updatedIds = prev.document_ids.includes(docId)
        ? prev.document_ids.filter(id => id !== docId)
        : [...prev.document_ids, docId];
      
      return {
        ...prev,
        document_ids: updatedIds
      };
    });
  };

  // Handle document upload success
  const handleDocumentUpload = (uploadedDocs) => {
    setDocumentUploaded(true);
    setUploadProgress(100);
    
    // Automatically select newly uploaded documents
    if (uploadedDocs && uploadedDocs.length > 0) {
      const newDocIds = uploadedDocs.map(doc => doc.id);
      setQuizData(prev => ({
        ...prev,
        document_ids: [...prev.document_ids, ...newDocIds]
      }));
      
      // If title is empty, use the first document's name (without extension)
      if (!quizData.title && uploadedDocs[0]?.filename) {
        const filename = uploadedDocs[0].filename;
        const nameWithoutExtension = filename.substring(0, filename.lastIndexOf('.')) || filename;
        setQuizData(prev => ({
          ...prev,
          title: `Quiz on ${nameWithoutExtension}`
        }));
      }
      
      // Try to extract a topic from the document
      attemptToExtractTopic(uploadedDocs[0]);
    }
  };

  // Progress simulation for upload
  const handleUploadStart = () => {
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        const newProgress = prev + Math.floor(Math.random() * 10);
        if (newProgress >= 90) {
          clearInterval(interval);
          return 90;
        }
        return newProgress;
      });
    }, 300);
  };

  // Extract topic from document content
  const attemptToExtractTopic = (document) => {
    if (!document || !document.content) return;
    
    setIsAnalyzing(true);
    
    try {
      // Simple approach using document content
      const extractTopic = (content) => {
        // Look for title-like content at the beginning
        const firstFewLines = content.split('\n').slice(0, 5).join(' ');
        const firstLine = firstFewLines.split('.')[0];
        
        // Extract key phrases that might be topics
        const possibleTopics = [];
        
        // Pattern: Look for "Introduction to X" or "X Guide" or similar patterns
        const introPattern = /introduction to ([\w\s]+)/i;
        const introMatch = content.match(introPattern);
        if (introMatch && introMatch[1]) {
          possibleTopics.push(introMatch[1]);
        }
        
        // Pattern: Look for section headers
        const sectionPattern = /(?:^|\n)##?\s+([\w\s]+)/;
        const sectionMatch = content.match(sectionPattern);
        if (sectionMatch && sectionMatch[1]) {
          possibleTopics.push(sectionMatch[1]);
        }
        
        // Pattern: Look for keywords
        const keywords = ['javascript', 'python', 'react', 'node', 'history', 'science', 'biology', 'physics', 'chemistry', 'literature'];
        for (const keyword of keywords) {
          if (content.toLowerCase().includes(keyword)) {
            possibleTopics.push(keyword);
            break;
          }
        }
        
        // If we found some potential topics, use the first one
        if (possibleTopics.length > 0) {
          return possibleTopics[0].trim();
        }
        
        // Fallback to first line or a portion of it
        if (firstLine.length > 50) {
          return firstLine.substring(0, 50) + '...';
        }
        
        return firstLine || 'Unknown Topic';
      };
      
      const extractedTopic = extractTopic(document.content);
      setSuggestedTopic(extractedTopic);
      
      // Auto-fill topic if empty
      if (!quizData.topic) {
        setQuizData(prev => ({
          ...prev,
          topic: extractedTopic
        }));
      }
    } catch (err) {
      console.error('Failed to extract topic:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setQuizData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Handle number input changes
  const handleNumberChange = (e) => {
    const { name, value } = e.target;
    const numValue = parseInt(value);
    
    if (!isNaN(numValue)) {
      setQuizData(prev => ({
        ...prev,
        [name]: numValue
      }));
    }
  };

  // Navigate to next step
  const nextStep = () => {
    setCurrentStep(prev => prev + 1);
  };

  // Navigate to previous step
  const prevStep = () => {
    setCurrentStep(prev => prev - 1);
  };

  // Check if can proceed to next step
  const canProceedToStep2 = () => {
    // Can proceed if documents are selected or user wants to create without documents
    return quizData.document_ids.length > 0 || currentStep >= 2;
  };

  // Check if can generate quiz
  const canGenerateQuiz = () => {
    return (
      quizData.topic.trim() !== '' && 
      quizData.num_questions > 0 &&
      (quizData.use_default_prompt || quizData.custom_prompt.trim() !== '')
    );
  };

  // Handle quiz generation
  const handleGenerateQuiz = async () => {
    if (!canGenerateQuiz()) {
      toast.error('Please fill all required fields');
      return;
    }
    
    try {
      // Prepare quiz data for API
      const finalQuizData = {
        ...quizData,
        // Set document_ids to null if empty to match API expectations
        document_ids: quizData.document_ids.length > 0 ? quizData.document_ids : null
      };
      
      // Add a default title if not provided
      if (!finalQuizData.title) {
        finalQuizData.title = `Quiz on ${finalQuizData.topic}`;
      }
      
      // Generate the quiz
      const result = await generateQuiz(finalQuizData);
      
      if (result) {
        toast.success('Quiz generated successfully!');
        navigate(`/quizzes/${result.id}`);
      }
    } catch (err) {
      toast.error('Failed to generate quiz');
      console.error('Generation error:', err);
    }
  };

  // Format date for documents
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // File type icons and classes
  const getFileTypeInfo = (fileType) => {
    const types = {
      'pdf': { icon: 'pdf', bgColor: 'bg-red-100', textColor: 'text-red-700' },
      'docx': { icon: 'docx', bgColor: 'bg-blue-100', textColor: 'text-blue-700' },
      'doc': { icon: 'doc', bgColor: 'bg-blue-100', textColor: 'text-blue-700' },
      'txt': { icon: 'txt', bgColor: 'bg-gray-100', textColor: 'text-gray-700' },
      'html': { icon: 'html', bgColor: 'bg-orange-100', textColor: 'text-orange-700' },
      'json': { icon: 'json', bgColor: 'bg-yellow-100', textColor: 'text-yellow-700' }
    };
    
    return types[fileType] || { icon: 'file', bgColor: 'bg-gray-100', textColor: 'text-gray-700' };
  };

  // Render Step 1: Document Selection
  const renderStep1 = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">Select Document Source</h2>
      
      {/* Document Upload Section */}
      <div className="bg-white rounded-lg shadow-md">
        <div 
          className="p-4 border-b cursor-pointer"
          onClick={() => setUploadPanelExpanded(!uploadPanelExpanded)}
        >
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium flex items-center">
              <DocumentPlusIcon className="h-5 w-5 text-primary-600 mr-2" />
              Upload New Document
            </h3>
            <ChevronRightIcon className={`h-5 w-5 text-gray-400 transition-transform ${uploadPanelExpanded ? 'rotate-90' : ''}`} />
          </div>
        </div>
        
        {uploadPanelExpanded && (
          <div className="p-6">
            <FileUpload 
              onUploadSuccess={handleDocumentUpload}
              onUploadStart={handleUploadStart}
            />
            
            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-primary-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="text-center text-sm text-gray-600 mt-2">
                  Uploading and processing document... {uploadProgress}%
                </p>
              </div>
            )}
            
            {documentUploaded && (
              <div className="mt-4 p-3 bg-green-100 text-green-800 rounded-md flex items-center">
                <CheckIcon className="h-5 w-5 mr-2" />
                Document uploaded successfully. It will appear in the list below.
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Document List Section */}
      <div className="bg-white rounded-lg shadow-md">
        <div 
          className="p-4 border-b cursor-pointer"
          onClick={() => setDocumentsExpanded(!documentsExpanded)}
        >
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium flex items-center">
              <DocumentTextIcon className="h-5 w-5 text-primary-600 mr-2" />
              Your Documents
              {quizData.document_ids.length > 0 && (
                <span className="ml-2 bg-primary-100 text-primary-800 text-xs font-medium px-2.5 py-0.5 rounded">
                  {quizData.document_ids.length} selected
                </span>
              )}
            </h3>
            <ChevronRightIcon className={`h-5 w-5 text-gray-400 transition-transform ${documentsExpanded ? 'rotate-90' : ''}`} />
          </div>
        </div>
        
        {documentsExpanded && (
          <div className="p-6">
            {documents.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <DocumentPlusIcon className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                <p>You have no documents yet. Upload one above.</p>
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {documents.map(doc => {
                    const fileInfo = getFileTypeInfo(doc.file_type.toLowerCase());
                    const isRecent = isRecentlyUploaded(doc);
                    
                    return (
                      <div 
                        key={doc.id}
                        onClick={() => handleDocumentSelect(doc.id)}
                        className={`
                          border rounded-lg p-4 cursor-pointer transition-all relative
                          ${quizData.document_ids.includes(doc.id) 
                            ? 'border-primary-300 bg-primary-50 shadow-md' 
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}
                        `}
                      >
                        {isRecent && (
                          <span className="absolute top-0 right-0 -mt-2 -mr-2 bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                            New
                          </span>
                        )}
                        
                        <div className="flex items-start">
                          <div className={`flex-shrink-0 p-2 ${fileInfo.bgColor} ${fileInfo.textColor} rounded-lg`}>
                            <DocumentTextIcon className="h-5 w-5" />
                          </div>
                          <div className="ml-3 flex-1">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {doc.filename}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {doc.file_type.toUpperCase()} · {formatDate(doc.created_at)}
                            </div>
                          </div>
                          {quizData.document_ids.includes(doc.id) && (
                            <CheckIcon className="h-5 w-5 text-primary-600" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {quizData.document_ids.length > 0 && (
                  <div className="mt-6 bg-blue-50 border border-blue-100 rounded-lg p-4">
                    <h4 className="font-medium text-blue-800 flex items-center">
                      <LightBulbIcon className="h-5 w-5 mr-2" />
                      Selected Documents ({quizData.document_ids.length})
                    </h4>
                    <ul className="mt-2 space-y-1">
                      {quizData.document_ids.map(id => {
                        const doc = documents.find(d => d.id === id);
                        return doc ? (
                          <li key={id} className="text-sm text-blue-700 flex justify-between">
                            <span>{doc.filename}</span>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDocumentSelect(id);
                              }}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              Remove
                            </button>
                          </li>
                        ) : null;
                      })}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {quizData.document_ids.length === 0 && documents.length > 0 && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-100 rounded-md flex items-center">
                <ExclamationCircleIcon className="h-5 w-5 text-yellow-600 mr-2" />
                <p className="text-sm text-yellow-800">
                  Please select at least one document for better quiz generation.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Skip Documents Option */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900">No Documents?</h3>
            <p className="text-sm text-gray-600 mt-1">
              You can also create a quiz without documents by specifying a topic directly.
            </p>
          </div>
          <Button
            onClick={() => nextStep()}
            variant="outline"
          >
            Skip Document Selection
          </Button>
        </div>
      </div>
      
      <div className="flex justify-between pt-4">
        <div></div>
        <div className="flex space-x-3">
          <Button
            onClick={() => nextStep()}
            disabled={!canProceedToStep2()}
            variant={canProceedToStep2() ? "primary" : "secondary"}
            className="flex items-center"
          >
            Continue
            <ChevronRightIcon className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );

  // Render Step 2: Quiz Details
  const renderStep2 = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">Quiz Details</h2>
      
      <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Quiz Title
          </label>
          <input
            type="text"
            id="title"
            name="title"
            value={quizData.title}
            onChange={handleInputChange}
            placeholder="Enter a title for your quiz"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Leave blank to auto-generate a title based on the topic
          </p>
        </div>
        
        <div>
          <label htmlFor="topic" className="block text-sm font-medium text-gray-700 mb-1">
            Quiz Topic <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              id="topic"
              name="topic"
              value={quizData.topic}
              onChange={handleInputChange}
              placeholder="What is this quiz about?"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              required
            />
            {isAnalyzing && (
              <div className="absolute right-3 top-2">
                <ArrowPathIcon className="h-5 w-5 text-gray-400 animate-spin" />
              </div>
            )}
          </div>
          {suggestedTopic && quizData.topic === suggestedTopic && (
            <p className="mt-1 text-xs text-gray-500 flex items-center">
              <LightBulbIcon className="h-3 w-3 mr-1" />
              Topic suggested from document content
            </p>
          )}
        </div>
        
        <div>
          <label htmlFor="num_questions" className="block text-sm font-medium text-gray-700 mb-1">
            Number of Questions <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setQuizData(prev => ({ 
                ...prev, 
                num_questions: Math.max(1, prev.num_questions - 1) 
              }))}
              className="p-2 border border-gray-300 rounded-l-md bg-gray-50 hover:bg-gray-100"
            >
              <span className="sr-only">Decrease</span>
              <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <input
              type="number"
              id="num_questions"
              name="num_questions"
              value={quizData.num_questions}
              onChange={handleNumberChange}
              min="1"
              max="20"
              className="w-16 text-center py-2 border-t border-b border-gray-300 focus:ring-0 focus:outline-none"
              required
            />
            <button
              type="button"
              onClick={() => setQuizData(prev => ({ 
                ...prev, 
                num_questions: Math.min(20, prev.num_questions + 1) 
              }))}
              className="p-2 border border-gray-300 rounded-r-md bg-gray-50 hover:bg-gray-100"
            >
              <span className="sr-only">Increase</span>
              <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Choose between 1-20 questions (10 recommended)
          </p>
        </div>
        
        <div className="pt-2">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="use_default_prompt"
              name="use_default_prompt"
              checked={quizData.use_default_prompt}
              onChange={handleInputChange}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="use_default_prompt" className="ml-2 block text-sm text-gray-700">
              Use default system prompt
            </label>
          </div>
          
          {!quizData.use_default_prompt && (
            <div className="mt-3">
              <label htmlFor="custom_prompt" className="block text-sm font-medium text-gray-700 mb-1">
                Custom Prompt <span className="text-red-500">*</span>
              </label>
              <textarea
                id="custom_prompt"
                name="custom_prompt"
                value={quizData.custom_prompt}
                onChange={handleInputChange}
                rows="4"
                placeholder="Enter your custom system prompt for quiz generation"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required={!quizData.use_default_prompt}
              />
              <p className="mt-1 text-xs text-gray-500">
                Provide instructions for the AI to generate better questions
              </p>
            </div>
          )}
        </div>
        
        <div className="pt-2">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="use_embeddings"
              name="use_embeddings"
              checked={quizData.use_embeddings}
              onChange={handleInputChange}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="use_embeddings" className="ml-2 block text-sm text-gray-700">
              Use semantic search for document analysis (better results but slower)
            </label>
          </div>
          <p className="ml-6 mt-1 text-xs text-gray-500">
            Uses AI embeddings to find the most relevant content in documents
          </p>
        </div>
      </div>
      
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
        <h3 className="font-medium text-blue-800 mb-2">Quiz Summary</h3>
        <ul className="space-y-1 text-sm text-blue-700">
          <li><span className="font-medium">Title:</span> {quizData.title || "(Auto-generated from topic)"}</li>
          <li><span className="font-medium">Topic:</span> {quizData.topic || "Not specified"}</li>
          <li><span className="font-medium">Questions:</span> {quizData.num_questions}</li>
          <li>
            <span className="font-medium">Documents:</span> {
              quizData.document_ids.length > 0 
                ? `${quizData.document_ids.length} selected` 
                : 'None (using topic only)'
            }
          </li>
          <li>
            <span className="font-medium">Prompt:</span> {
              quizData.use_default_prompt ? 'Default system prompt' : 'Custom prompt'
            }
          </li>
        </ul>
      </div>
      
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}
      
      <div className="flex justify-between pt-4">
        <Button
          onClick={() => prevStep()}
          variant="secondary"
          className="flex items-center"
        >
          <ChevronLeftIcon className="h-4 w-4 mr-1" />
          Back
        </Button>
        
        <Button
          onClick={handleGenerateQuiz}
          variant="primary"
          disabled={isGenerating || !canGenerateQuiz()}
          className="flex items-center"
        >
          {isGenerating ? (
            <>
              <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <PaperAirplaneIcon className="h-4 w-4 mr-2" />
              Generate Quiz
            </>
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">Create a New Quiz</h1>
      
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex mb-2">
          {[1, 2].map((step) => (
            <div key={step} className="flex-1 flex">
              <div 
                className={`
                  w-full h-2 rounded-full 
                  ${currentStep >= step ? 'bg-primary-600' : 'bg-gray-200'}
                  ${step === 1 ? 'rounded-r-none' : ''}
                  ${step === 2 ? 'rounded-l-none' : ''}
                `}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs font-medium text-gray-500">
          <span className={currentStep >= 1 ? 'text-primary-600' : ''}>Document Selection</span>
          <span className={currentStep >= 2 ? 'text-primary-600' : ''}>Quiz Details</span>
        </div>
      </div>
      
      {/* Steps */}
      {currentStep === 1 && renderStep1()}
      {currentStep === 2 && renderStep2()}
    </div>
  );
};

export default QuizBuilder;