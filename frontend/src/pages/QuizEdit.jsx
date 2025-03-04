// frontend/src/pages/QuizEdit.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { toast } from 'react-hot-toast';
import useAppStore from '../store/appStore';
import Button from '../components/common/Button';
import QuizSettingsPanel from '../components/quiz/QuizSettingsPanel';
import QuizSummaryPanel from '../components/quiz/QuizSummaryPanel';
import QuestionsList from '../components/quiz/QuestionsList';
import QuestionEditor from '../components/quiz/QuestionEditor';
import QuizHistory from '../components/quiz/QuizHistory';
import useOutsideClick from '../hooks/useOutsideClick';
import {
  EyeIcon,
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  DocumentDuplicateIcon,
  PlusCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

const QuizEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    currentQuiz,
    fetchQuiz,
    updateQuiz,
    regenerateQuiz,
    revertQuiz,
    regenerateQuestion,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    convertQuestionType,
    revertQuestion,
    isLoading,
    isGenerating,
    error,
    clearError
  } = useAppStore();

  // Local state
  const [localQuiz, setLocalQuiz] = useState(null);
  const [quizForm, setQuizForm] = useState({
    title: '',
    topic: '',
    description: '',
    use_default_prompt: true,
    custom_prompt: ''
  });
  const [expandedSettings, setExpandedSettings] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [newQuestionMode, setNewQuestionMode] = useState(false);
  const [expandedQuestionId, setExpandedQuestionId] = useState('all'); // 'all' means expand all questions
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [showQuizHistory, setShowQuizHistory] = useState(false);
  const [regeneratingQuestions, setRegeneratingQuestions] = useState({});
  
  // Refs to handle auto-focus and auto-scroll
  const editingQuestionRef = useRef(null);
  const newQuestionRef = useRef(null);
  const historyModalRef = useRef(null);
  
  // Configure outside click handler for quiz history
  useOutsideClick(historyModalRef, () => setShowQuizHistory(false), showQuizHistory);
  
  // Fetch quiz data on component mount
  useEffect(() => {
    const loadQuiz = async () => {
      const result = await fetchQuiz(id);
      if (!result) {
        navigate('/quizzes');
        toast.error('Quiz not found');
      }
    };
    
    loadQuiz();
    clearError();
    
    return () => {
      clearError();
    };
  }, [id, fetchQuiz, navigate, clearError]);

  // Update local quiz state when the backend data changes
  useEffect(() => {
    if (currentQuiz) {
      setLocalQuiz({...currentQuiz});
      setQuizForm({
        title: currentQuiz.title || '',
        topic: currentQuiz.topic || '',
        description: currentQuiz.description || '',
        use_default_prompt: currentQuiz.use_default_prompt,
        custom_prompt: currentQuiz.custom_prompt || ''
      });
      
      // Set all questions to expanded by default
      setExpandedQuestionId('all');
    }
  }, [currentQuiz]);

  // Scroll to editing question when it changes
  useEffect(() => {
    if (editingQuestionId && editingQuestionRef.current) {
      editingQuestionRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
    }
  }, [editingQuestionId]);

  // Scroll to new question when added
  useEffect(() => {
    if (newQuestionMode && newQuestionRef.current) {
      newQuestionRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
    }
  }, [newQuestionMode]);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setQuizForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Save quiz settings
  const handleSaveQuiz = async () => {
    try {
      // Update local state first (optimistic update)
      setLocalQuiz(prev => ({
        ...prev,
        title: quizForm.title,
        topic: quizForm.topic,
        description: quizForm.description,
        use_default_prompt: quizForm.use_default_prompt,
        custom_prompt: quizForm.custom_prompt
      }));
      
      // Then update backend
      const result = await updateQuiz(id, quizForm);
      if (result) {
        toast.success('Quiz updated successfully');
        setExpandedSettings(false);
      }
    } catch (error) {
      toast.error('Failed to update quiz');
      console.error(error);
    }
  };

  // Regenerate entire quiz
  const handleRegenerateQuiz = async () => {
    try {
      const result = await regenerateQuiz(id);
      if (result) {
        toast.success('Quiz regenerated successfully');
        setLocalQuiz(result); // Update local state with new quiz
      }
    } catch (error) {
      toast.error('Failed to regenerate quiz');
      console.error(error);
    }
  };

  // Show quiz history
  const handleShowQuizHistory = () => {
    setShowQuizHistory(true);
  };

  // Handle quiz reverted from history modal
  const handleQuizReverted = (revertedQuiz) => {
    // Update the local state with the reverted quiz
    setLocalQuiz(revertedQuiz);
    setQuizForm({
      title: revertedQuiz.title || '',
      topic: revertedQuiz.topic || '',
      description: revertedQuiz.description || '',
      use_default_prompt: revertedQuiz.use_default_prompt,
      custom_prompt: revertedQuiz.custom_prompt || ''
    });
  };

  // Quick revert quiz to previous version
  const handleRevertQuiz = async () => {
    try {
      const result = await revertQuiz(id);
      if (result) {
        toast.success('Quiz reverted to previous version');
        setLocalQuiz(result); // Update local state with reverted quiz
        setQuizForm({
          title: result.title || '',
          topic: result.topic || '',
          description: result.description || '',
          use_default_prompt: result.use_default_prompt,
          custom_prompt: result.custom_prompt || ''
        });
      }
    } catch (error) {
      toast.error('Failed to revert quiz');
      console.error(error);
    }
  };

  // Start editing a question
  const handleStartEditQuestion = (questionId) => {
    setNewQuestionMode(false);
    setEditingQuestionId(questionId);
    setExpandedQuestionId(questionId);
  };

  // Cancel editing a question
  const handleCancelEditQuestion = () => {
    setEditingQuestionId(null);
    setNewQuestionMode(false);
    setExpandedQuestionId('all'); // Revert to all expanded
  };

  // Toggle question expansion
  const toggleQuestionExpand = (questionId) => {
    if (expandedQuestionId === 'all') {
      // If all questions are expanded, only keep this one expanded
      setExpandedQuestionId(questionId);
    } else if (expandedQuestionId === questionId) {
      // If this question is the only one expanded, expand all
      setExpandedQuestionId('all');
    } else {
      // If another question is expanded, expand this one instead
      setExpandedQuestionId(questionId);
    }
  };

  // Save question changes
  const handleSaveQuestion = async (questionId, updatedData) => {
    try {
      const result = await updateQuestion(id, questionId, updatedData);
      if (result) {
        toast.success('Question updated');
        setEditingQuestionId(null);
        
        // Update the local quiz state to reflect changes immediately
        setLocalQuiz(prev => ({
          ...prev,
          questions: prev.questions.map(q => 
            q.id === questionId ? result : q
          )
        }));
        
        // Set back to all expanded
        setExpandedQuestionId('all');
      }
    } catch (error) {
      toast.error('Failed to update question');
      console.error(error);
    }
  };

  // Delete a question
  const handleDeleteQuestion = async (questionId) => {
    try {
      const result = await deleteQuestion(id, questionId);
      if (result) {
        toast.success('Question deleted');
        setConfirmDeleteId(null);
        
        // Update the local quiz state to remove the deleted question
        setLocalQuiz(prev => ({
          ...prev,
          questions: prev.questions.filter(q => q.id !== questionId)
        }));
      }
    } catch (error) {
      toast.error('Failed to delete question');
      console.error(error);
    }
  };

  // Regenerate a single question
  const handleRegenerateQuestion = async (questionId) => {
    // Set this specific question as regenerating
    setRegeneratingQuestions(prev => ({
      ...prev,
      [questionId]: true
    }));
    
    try {
      const result = await regenerateQuestion(id, questionId);
      if (result) {
        toast.success('Question regenerated');
        
        // Update the local quiz state to reflect changes immediately
        setLocalQuiz(prev => ({
          ...prev,
          questions: prev.questions.map(q => 
            q.id === questionId ? result : q
          )
        }));
      }
    } catch (error) {
      toast.error('Failed to regenerate question');
      console.error(error);
    } finally {
      // Clear regenerating state
      setRegeneratingQuestions(prev => ({
        ...prev,
        [questionId]: false
      }));
    }
  };

  // Change question type
  const handleChangeQuestionType = async (questionId, newType) => {
    try {
      const result = await convertQuestionType(id, questionId, newType);
      if (result) {
        toast.success(`Question converted to ${newType} type`);
        
        // Update the local quiz state to reflect changes immediately
        setLocalQuiz(prev => ({
          ...prev,
          questions: prev.questions.map(q => 
            q.id === questionId ? result : q
          )
        }));
      }
    } catch (error) {
      toast.error('Failed to change question type');
      console.error(error);
    }
  };

  // Handle adding a new question
  const handleAddQuestion = () => {
    setEditingQuestionId(null);
    setNewQuestionMode(true);
    setExpandedQuestionId(null);
    
    // Scroll to the bottom where the new question form will appear
    setTimeout(() => {
      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: 'smooth'
      });
      
      // Also try to scroll using the ref if available
      if (newQuestionRef.current) {
        newQuestionRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }
    }, 100);
  };

  // Save a new question
  const handleSaveNewQuestion = async (newQuestionData) => {
    try {
      // Add position property based on current questions count
      const position = localQuiz.questions.length;
      const completeQuestionData = {
        ...newQuestionData,
        position: position
      };
      
      const savedQuestion = await addQuestion(id, completeQuestionData);
      if (savedQuestion) {
        toast.success('New question added');
        setNewQuestionMode(false);
        
        // Update the local quiz state to add the new question
        setLocalQuiz(prev => ({
          ...prev,
          questions: [...prev.questions, savedQuestion]
        }));
        
        // Set back to all expanded
        setExpandedQuestionId('all');
      }
    } catch (error) {
      toast.error('Failed to add question');
      console.error(error);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Sort questions by position
  const sortedQuestions = localQuiz?.questions 
    ? [...localQuiz.questions].sort((a, b) => a.position - b.position)
    : [];

  if (isLoading && !localQuiz) {
    return (
      <div className="flex justify-center items-center h-64">
        <ArrowPathIcon className="h-12 w-12 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (!localQuiz) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <DocumentDuplicateIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Quiz not found</h2>
          <p className="text-gray-600 mb-6">
            The quiz you're looking for might have been deleted or doesn't exist.
          </p>
          <Button
            onClick={() => navigate('/quizzes')}
            variant="primary"
          >
            Back to Quizzes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{localQuiz.title || 'Edit Quiz'} | AI Quiz Generator</title>
      </Helmet>
      
      <div className="container mx-auto px-4 py-8">
        {/* Quiz Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{localQuiz.title}</h1>
            <p className="text-gray-600">
              {localQuiz.questions.length} questions · Created on {formatDate(localQuiz.created_at)}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => navigate(`/quizzes/${id}/preview`)}
              variant="outline"
              className="flex items-center"
            >
              <EyeIcon className="h-4 w-4 mr-1" />
              Preview Quiz
            </Button>
            
            <Button
              onClick={handleShowQuizHistory}
              variant="outline"
              className="flex items-center"
            >
              <ClockIcon className="h-4 w-4 mr-1" />
              View History
            </Button>
            
            <Button
              onClick={handleRegenerateQuiz}
              variant="secondary"
              disabled={isGenerating}
              className="flex items-center"
            >
              <ArrowPathIcon className={`h-4 w-4 mr-1 ${isGenerating ? 'animate-spin' : ''}`} />
              {isGenerating ? 'Regenerating...' : 'Regenerate All'}
            </Button>
            
            <Button
              onClick={handleRevertQuiz}
              variant="outline"
              disabled={isLoading}
              className="flex items-center"
            >
              <ArrowUturnLeftIcon className="h-4 w-4 mr-1" />
              Quick Revert
            </Button>
          </div>
        </div>
        
        {error && (
          <div className="mb-6 p-4 bg-red-100 text-red-800 rounded-lg">
            Error: {error}
          </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quiz Settings Panel */}
          <div className="lg:col-span-1">
            <QuizSettingsPanel 
              quizForm={quizForm}
              handleInputChange={handleInputChange}
              handleSaveQuiz={handleSaveQuiz}
              expandedSettings={expandedSettings}
              setExpandedSettings={setExpandedSettings}
              currentQuiz={localQuiz}
              isLoading={isLoading}
            />
            
            {/* Quiz Summary */}
            <QuizSummaryPanel 
              quiz={localQuiz} 
              formatDate={formatDate} 
            />
          </div>
          
          {/* Questions Panel */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-800">Questions</h2>
                <Button
                  onClick={handleAddQuestion}
                  variant="outline"
                  size="sm"
                  className="flex items-center"
                  disabled={isGenerating}
                >
                  <PlusCircleIcon className="h-4 w-4 mr-1" />
                  Add Question
                </Button>
              </div>
              
              {/* Questions List */}
              <div className="p-4 space-y-4">
                <QuestionsList 
                  questions={sortedQuestions}
                  editingQuestionId={editingQuestionId}
                  expandedQuestionId={expandedQuestionId}
                  confirmDeleteId={confirmDeleteId}
                  editingQuestionRef={editingQuestionRef}
                  toggleQuestionExpand={toggleQuestionExpand}
                  handleStartEditQuestion={handleStartEditQuestion}
                  handleRegenerateQuestion={handleRegenerateQuestion}
                  setConfirmDeleteId={setConfirmDeleteId}
                  handleChangeQuestionType={handleChangeQuestionType}
                  handleDeleteQuestion={handleDeleteQuestion}
                  handleCancelEditQuestion={handleCancelEditQuestion}
                  handleSaveQuestion={handleSaveQuestion}
                  isGenerating={isGenerating}
                  quizId={id}  // Pass the quiz ID
                  regeneratingQuestions={regeneratingQuestions}
                />
                
                {/* New Question Form */}
                {newQuestionMode && (
                  <div 
                    ref={newQuestionRef}
                    className="border-2 border-primary-300 bg-blue-50 rounded-lg overflow-hidden mt-6"
                  >
                    <h3 className="bg-primary-600 text-white px-4 py-2">Add New Question</h3>
                    <QuestionEditor 
                      question={{
                        question_text: '',
                        question_type: 'multiple_choice',
                        explanation: '',
                        answers: [
                          { answer_text: '', is_correct: true, position: 0 },
                          { answer_text: '', is_correct: false, position: 1 },
                          { answer_text: '', is_correct: false, position: 2 },
                          { answer_text: '', is_correct: false, position: 3 }
                        ]
                      }}
                      onSave={handleSaveNewQuestion}
                      onCancel={() => setNewQuestionMode(false)}
                      isNew={true}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Quiz History Modal */}
        {showQuizHistory && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div ref={historyModalRef} className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] flex flex-col">
              <QuizHistory 
                quizId={id}
                onRevert={handleQuizReverted}
                onClose={() => setShowQuizHistory(false)}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default QuizEdit;