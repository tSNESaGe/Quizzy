// frontend/src/components/quiz/QuizBuilder.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAppStore from '../../store/appStore';
import { toast } from 'react-hot-toast';
import { 
  DocumentTextIcon, 
  PlusCircleIcon, 
  CheckCircleIcon,
  ArrowPathIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  DocumentPlusIcon
} from '@heroicons/react/24/outline';
import FileUpload from '../common/FileUpload';
import Button from '../common/Button';

const QuizBuilder = () => {
  const navigate = useNavigate();
  const { 
    documents, 
    fetchDocuments, 
    generateQuiz,
    clearError,
    isGenerating,
    error
  } = useAppStore();

  // Form state
  const [currentStep, setCurrentStep] = useState(1);
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
  const [documentUploaded, setDocumentUploaded] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestedTopic, setSuggestedTopic] = useState('');

  // Fetch documents on component mount
  useEffect(() => {
    fetchDocuments();
    clearError();
    
    return () => clearError();
  }, [fetchDocuments, clearError]);

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

  // Extract topic from document content (simple heuristic)
  const attemptToExtractTopic = (document) => {
    if (!document || !document.content) return;
    
    setIsAnalyzing(true);
    
    try {
      // Simple approach: Take first sentence or up to 100 chars
      const content = document.content;
      const firstSentence = content.split('.')[0];
      const topic = firstSentence.length > 100 
        ? firstSentence.substring(0, 100) + '...'
        : firstSentence;
      
      setSuggestedTopic(topic);
      
      // Auto-fill topic if empty
      if (!quizData.topic) {
        setQuizData(prev => ({
          ...prev,
          topic: topic
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

  // Render Step 1: Document Selection
  const renderStep1 = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">Select Document Source</h2>
      
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium mb-4">Upload New Document</h3>
        <FileUpload onUploadSuccess={handleDocumentUpload} />
        
        {documentUploaded && (
          <div className="mt-4 p-3 bg-green-100 text-green-800 rounded-md flex items-center">
            <CheckCircleIcon className="h-5 w-5 mr-2" />
            Document uploaded successfully. It will appear in the list below.
          </div>
        )}
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium mb-4">Your Documents</h3>
        
        {documents.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <DocumentPlusIcon className="h-12 w-12 mx-auto text-gray-400 mb-3" />
            <p>You have no documents yet. Upload one above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map(doc => (
              <div 
                key={doc.id}
                onClick={() => handleDocumentSelect(doc.id)}
                className={`
                  border rounded-lg p-4 cursor-pointer transition-all
                  ${quizData.document_ids.includes(doc.id) 
                    ? 'border-blue-500 bg-blue-50 shadow-md' 
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}
                `}
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <DocumentTextIcon className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="ml-3 flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {doc.filename}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {doc.file_type.toUpperCase()} · {new Date(doc.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  {quizData.document_ids.includes(doc.id) && (
                    <CheckCircleIcon className="h-5 w-5 text-blue-600" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
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
      
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
            {isAnalyzing && (
              <div className="absolute right-3 top-2">
                <ArrowPathIcon className="h-5 w-5 text-gray-400 animate-spin" />
              </div>
            )}
          </div>
          {suggestedTopic && quizData.topic === suggestedTopic && (
            <p className="mt-1 text-xs text-gray-500">
              Topic suggested from document content
            </p>
          )}
        </div>
        
        <div>
          <label htmlFor="num_questions" className="block text-sm font-medium text-gray-700 mb-1">
            Number of Questions <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            id="num_questions"
            name="num_questions"
            value={quizData.num_questions}
            onChange={handleNumberChange}
            min="1"
            max="20"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
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
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="use_embeddings" className="ml-2 block text-sm text-gray-700">
              Use semantic search (better results but slower)
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
              <PlusCircleIcon className="h-4 w-4 mr-2" />
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
                  ${currentStep >= step ? 'bg-blue-600' : 'bg-gray-200'}
                  ${step === 1 ? 'rounded-r-none' : ''}
                  ${step === 2 ? 'rounded-l-none' : ''}
                `}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs font-medium text-gray-500">
          <span className={currentStep >= 1 ? 'text-blue-600' : ''}>Document Selection</span>
          <span className={currentStep >= 2 ? 'text-blue-600' : ''}>Quiz Details</span>
        </div>
      </div>
      
      {/* Steps */}
      {currentStep === 1 && renderStep1()}
      {currentStep === 2 && renderStep2()}
    </div>
  );
};

export default QuizBuilder;