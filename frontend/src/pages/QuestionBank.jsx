// frontend/src/pages/QuestionBank.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { toast } from 'react-hot-toast';
import useAppStore from '../store/appStore';
import Button from '../components/common/Button';
import {
  QuestionMarkCircleIcon,
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
  FunnelIcon,
  ClipboardDocumentIcon,
  PencilIcon,
  TrashIcon,
  PlusCircleIcon,
  CheckCircleIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline';

const QuestionBank = () => {
  const navigate = useNavigate();
  const { 
    quizzes,
    fetchQuizzes,
    deleteQuestion,
    unassignedQuestions,
    fetchUnassignedQuestions,
    isLoading
  } = useAppStore();

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedQuiz, setSelectedQuiz] = useState('all');
  const [expandedQuestionId, setExpandedQuestionId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [copySuccess, setCopySuccess] = useState(null);
  const [sortOption, setSortOption] = useState('quiz'); // 'quiz', 'type', 'updated'
  
  useEffect(() => {
    fetchQuizzes();
    fetchUnassignedQuestions();
  }, [fetchQuizzes, fetchUnassignedQuestions]);

  // Fetch quizzes on component mount
  useEffect(() => {
    fetchQuizzes();
  }, [fetchQuizzes]);

  // Extract all questions from all quizzes
  const allQuestions = useMemo(() => {
    if (!quizzes || !quizzes.length) return [];
    
    // Get questions from quizzes
    const questionsFromQuizzes = quizzes.flatMap(quiz => 
        (quiz.questions || []).map(question => ({
        ...question,
        quizTitle: quiz.title,
        quizId: quiz.id,
        quizTopic: quiz.topic
        }))
    );
    
    // Add unassigned questions
    const unassignedQuestionsWithMetadata = (unassignedQuestions || []).map(question => ({
        ...question,
        quizTitle: null,
        quizId: null,
        quizTopic: null
    }));
    
    // Combine both sets of questions
    return [
        ...questionsFromQuizzes,
        ...unassignedQuestionsWithMetadata
    ];
    }, [quizzes, unassignedQuestions]);

  // Create unique quiz options for filter dropdown
  const quizOptions = useMemo(() => {
    if (!quizzes || !quizzes.length) return [];
    
    return [
      { id: 'all', title: 'All Quizzes' },
      { id: 'unassigned', title: 'Unassigned Questions' }, // Add this line
      ...quizzes.map(quiz => ({ id: quiz.id, title: quiz.title }))
    ];
  }, [quizzes]);

  // Apply filters and search to questions
  const filteredQuestions = useMemo(() => {
    if (!allQuestions.length) return [];
    
    return allQuestions.filter(question => {
      // Filter by quiz
      if (selectedQuiz === 'unassigned') {
        // Show only questions with no quizId
        if (question.quizId) {
          return false;
        }
      } else if (selectedQuiz !== 'all' && question.quizId !== parseInt(selectedQuiz)) {
        return false;
      }
      
      // Filter by question type
      if (selectedType !== 'all' && question.question_type !== selectedType) {
        return false;
      }
      
      // Filter by search query
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        const questionTextMatch = question.question_text.toLowerCase().includes(searchLower);
        const answerMatch = question.answers.some(a => 
          a.answer_text.toLowerCase().includes(searchLower)
        );
        const explanationMatch = question.explanation?.toLowerCase().includes(searchLower);
        
        return questionTextMatch || answerMatch || explanationMatch;
      }
      
      return true;
    });
  }, [allQuestions, selectedQuiz, selectedType, searchQuery]);

  // Sort questions
  const sortedQuestions = useMemo(() => {
    if (!filteredQuestions.length) return [];
    
    const sorted = [...filteredQuestions];
    
    switch (sortOption) {
      case 'quiz':
        return sorted.sort((a, b) => a.quizTitle.localeCompare(b.quizTitle));
      case 'type':
        return sorted.sort((a, b) => a.question_type.localeCompare(b.question_type));
      case 'updated':
        return sorted.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      case 'position':
        return sorted.sort((a, b) => a.position - b.position);
      default:
        return sorted;
    }
  }, [filteredQuestions, sortOption]);

  const handleDelete = async (questionId, quizId) => {
    try {
      await deleteQuestion(quizId, questionId);
      toast.success('Question deleted successfully');
      setConfirmDeleteId(null);
    } catch (error) {
      toast.error('Failed to delete question');
    }
  };

  const handleCopyToClipboard = (question) => {
    const answersList = question.answers.map(a => 
      `${a.is_correct ? '✓' : '○'} ${a.answer_text}`
    ).join('\n');
    
    const text = `Question: ${question.question_text}\n\nAnswers:\n${answersList}${question.explanation ? `\n\nExplanation: ${question.explanation}` : ''}`;
    
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopySuccess(question.id);
        setTimeout(() => setCopySuccess(null), 3000);
        toast.success('Question copied to clipboard');
      })
      .catch(() => {
        toast.error('Failed to copy question');
      });
  };

  const handleEditQuestion = (questionId, quizId) => {
    navigate(`/quizzes/${quizId}`, { state: { editingQuestionId: questionId } });
  };

  const toggleExpand = (questionId) => {
    setExpandedQuestionId(expandedQuestionId === questionId ? null : questionId);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedType('all');
    setSelectedQuiz('all');
  };

  // Filter by question type options
  const typeOptions = [
    { id: 'all', label: 'All Types' },
    { id: 'multiple_choice', label: 'Multiple Choice' },
    { id: 'boolean', label: 'True/False' }
  ];

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <>
      <Helmet>
        <title>Question Bank | AI Quiz Generator</title>
      </Helmet>
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Question Bank</h1>
            <p className="text-gray-600">View and manage all your quiz questions in one place</p>
          </div>
          
          <Button
            onClick={() => navigate('/quizzes/new')}
            className="flex items-center justify-center"
          >
            <PlusCircleIcon className="w-5 h-5 mr-2" />
            Create New Quiz
          </Button>
        </div>
        
        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-4">
            {/* Search */}
            <div className="relative flex-grow">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                placeholder="Search questions, answers, or explanations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            {/* Quiz Filter */}
            <div className="relative min-w-[180px]">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <ClipboardDocumentIcon className="h-5 w-5 text-gray-400" />
              </div>
              <select
                className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                value={selectedQuiz}
                onChange={(e) => setSelectedQuiz(e.target.value)}
              >
                {quizOptions.map(option => (
                  <option key={option.id} value={option.id}>
                    {option.title}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Question Type Filter */}
            <div className="relative min-w-[150px]">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <QuestionMarkCircleIcon className="h-5 w-5 text-gray-400" />
              </div>
              <select
                className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
              >
                {typeOptions.map(option => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Sort Options */}
            <div className="relative min-w-[150px]">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <AdjustmentsHorizontalIcon className="h-5 w-5 text-gray-400" />
              </div>
              <select
                className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
              >
                <option value="quiz">Sort by Quiz</option>
                <option value="type">Sort by Type</option>
                <option value="updated">Sort by Last Updated</option>
                <option value="position">Sort by Position</option>
              </select>
            </div>
          </div>
          
          {/* Active Filters */}
          {(searchQuery || selectedType !== 'all' || selectedQuiz !== 'all') && (
            <div className="flex items-center mt-3 ml-1">
              <FunnelIcon className="h-4 w-4 text-primary-600 mr-2" />
              <span className="text-sm text-gray-600 mr-2">Active filters:</span>
              <div className="flex flex-wrap gap-2">
                {searchQuery && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                    Search: {searchQuery}
                  </span>
                )}
                {selectedType !== 'all' && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                    Type: {selectedType === 'multiple_choice' ? 'Multiple Choice' : 'True/False'}
                  </span>
                )}
                {selectedQuiz !== 'all' && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                    Quiz: {quizOptions.find(q => q.id.toString() === selectedQuiz)?.title}
                  </span>
                )}
                <button
                  onClick={clearFilters}
                  className="text-xs text-primary-600 hover:text-primary-800 ml-2"
                >
                  Clear all
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Results count */}
        <div className="mb-4 text-sm text-gray-500">
          {filteredQuestions.length} {filteredQuestions.length === 1 ? 'question' : 'questions'} found
        </div>
        
        {/* Questions List */}
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <ArrowPathIcon className="w-8 h-8 text-primary-500 animate-spin" />
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div className="bg-white shadow-md rounded-lg p-8 text-center">
            <QuestionMarkCircleIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">No questions found</h2>
            <p className="text-gray-600 mb-6">
              {quizzes.length === 0 
                ? "You haven't created any quizzes yet."
                : "No questions match your current filters."}
            </p>
            <Button
              onClick={() => clearFilters()}
              variant="outline"
              className="mr-2"
            >
              Clear Filters
            </Button>
            <Button
              onClick={() => navigate('/quizzes/new')}
              variant="primary"
            >
              Create New Quiz
            </Button>
          </div>
        ) : (
          <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <ul className="divide-y divide-gray-200">
              {sortedQuestions.map((question) => (
                <li key={question.id} className="transition-colors">
                  <div className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full mr-2 ${
                            question.question_type === 'multiple_choice'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {question.question_type === 'multiple_choice' ? 'Multiple Choice' : 'True/False'}
                          </span>
                          {question.quizId ? (
                            <Link 
                                to={`/quizzes/${question.quizId}`}
                                className="text-xs text-gray-500 hover:text-primary-600"
                            >
                                {question.quizTitle}
                            </Link>
                            ) : (
                            <span className="text-xs text-amber-500 font-medium px-2 py-0.5 rounded-full bg-amber-100">
                                Unassigned
                            </span>
                            )}
                        </div>
                        
                        <h3 className="text-lg font-medium text-gray-900">
                          {question.question_text}
                        </h3>
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => toggleExpand(question.id)}
                          className="p-1 text-gray-500 hover:text-gray-700 rounded"
                          aria-label="Expand question"
                        >
                          <svg 
                            className={`w-5 h-5 transition-transform ${expandedQuestionId === question.id ? 'rotate-180' : ''}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        
                        <button
                          onClick={() => handleCopyToClipboard(question)}
                          className={`p-1 rounded ${copySuccess === question.id ? 'text-green-600' : 'text-gray-500 hover:text-gray-700'}`}
                          aria-label="Copy to clipboard"
                        >
                          {copySuccess === question.id ? (
                            <CheckCircleIcon className="w-5 h-5" />
                          ) : (
                            <ClipboardDocumentIcon className="w-5 h-5" />
                          )}
                        </button>
                        
                        <button
                          onClick={() => handleEditQuestion(question.id, question.quizId)}
                          className="p-1 text-blue-600 hover:text-blue-800 rounded"
                          aria-label="Edit question"
                        >
                          <PencilIcon className="w-5 h-5" />
                        </button>
                        
                        <button
                          onClick={() => setConfirmDeleteId(question.id)}
                          className="p-1 text-red-500 hover:text-red-700 rounded"
                          aria-label="Delete question"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    
                    {/* Expanded content */}
                    {expandedQuestionId === question.id && (
                      <div className="mt-4">
                        <div className="space-y-2">
                          {question.answers.map((answer) => (
                            <div 
                              key={answer.id}
                              className={`p-3 border rounded-lg ${
                                answer.is_correct 
                                  ? 'bg-green-50 border-green-300' 
                                  : 'bg-gray-50 border-gray-200'
                              }`}
                            >
                              <div className="flex items-start">
                                <div className={`flex-shrink-0 w-5 h-5 rounded-full border ${
                                  answer.is_correct 
                                    ? 'border-green-500 bg-green-500' 
                                    : 'border-gray-400'
                                  } flex items-center justify-center mt-0.5 mr-3`}>
                                  {answer.is_correct && (
                                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                                    </svg>
                                  )}
                                </div>
                                <span className={answer.is_correct ? 'font-medium' : ''}>
                                  {answer.answer_text}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {question.explanation && (
                          <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                            <p className="text-sm font-medium text-blue-800 mb-1">Explanation:</p>
                            <p className="text-sm text-blue-700">{question.explanation}</p>
                          </div>
                        )}
                        
                        <div className="mt-4 flex items-center justify-between">
                          <div className="text-xs text-gray-500">
                            <span>Last updated: {formatDate(question.updated_at)}</span>
                            <span className="mx-2">•</span>
                            <span>Position: {question.position}</span>
                          </div>
                          
                          {question.quizId ? (
                            <Link
                                to={`/quizzes/${question.quizId}`}
                                className="text-sm text-primary-600 hover:text-primary-800 flex items-center"
                            >
                                Go to Quiz
                                <ArrowTopRightOnSquareIcon className="w-4 h-4 ml-1" />
                            </Link>
                            ) : (
                            <span className="text-sm text-amber-600 flex items-center">
                                Unassigned Question
                            </span>
                            )}
                        </div>
                      </div>
                    )}
                    
                    {/* Delete confirmation */}
                    {confirmDeleteId === question.id && (
                      <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-red-700 mb-3">
                          Are you sure you want to delete this question? This action cannot be undone.
                        </p>
                        <div className="flex justify-end space-x-3">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            Cancel
                          </Button>
                          <Button 
                            size="sm" 
                            variant="danger"
                            onClick={() => handleDelete(question.id, question.quizId)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
};

export default QuestionBank;