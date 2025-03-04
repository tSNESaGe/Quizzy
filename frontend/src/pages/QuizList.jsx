// frontend/src/pages/QuizList.jsx
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { toast } from 'react-hot-toast';
import useAppStore from '../store/appStore';
import { getQuizzes, deleteQuiz } from '../services/api';
import Button from '../components/common/Button';
import {
  PlusIcon,
  DocumentTextIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  ChevronDownIcon,
  ArrowPathIcon,
  DocumentDuplicateIcon
} from '@heroicons/react/24/outline';

const QuizList = () => {
  const navigate = useNavigate();
  const { quizzes, setQuizzes } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [expandedQuizId, setExpandedQuizId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  
  // Fetch quizzes data
  useEffect(() => {
    async function fetchQuizzes() {
      setLoading(true);
      try {
        const response = await getQuizzes();
        setQuizzes(response);
      } catch (error) {
        toast.error('Failed to load quizzes');
      } finally {
        setLoading(false);
      }
    }
    fetchQuizzes();
  }, [setQuizzes]);

  // Toggle expanded details for a quiz
  const toggleExpand = (id) => {
    setExpandedQuizId(expandedQuizId === id ? null : id);
  };

  // Handle quiz deletion
  const handleDeleteQuiz = async (id) => {
    setLoading(true);
    try {
      await deleteQuiz(id);
      // Remove quiz from local state
      setQuizzes(quizzes.filter(quiz => quiz.id !== id));
      toast.success('Quiz deleted successfully');
      setDeleteConfirmId(null);
    } catch (error) {
      toast.error('Failed to delete quiz');
    } finally {
      setLoading(false);
    }
  };

  // Format date
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
        <title>Quizzes | AI Quiz Generator</title>
      </Helmet>
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Quizzes</h1>
            <p className="text-gray-600">Manage your quizzes and create new ones</p>
          </div>
          
          <Button
            onClick={() => navigate('/quizzes/new')}
            className="flex items-center justify-center"
          >
            <PlusIcon className="w-5 h-5 mr-2" />
            Create New Quiz
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <ArrowPathIcon className="w-8 h-8 text-primary-500 animate-spin" />
          </div>
        ) : quizzes.length === 0 ? (
          <div className="bg-white shadow-md rounded-lg p-8 text-center">
            <DocumentDuplicateIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">No quizzes yet</h2>
            <p className="text-gray-600 mb-6">
              Start by creating your first quiz to test your knowledge or share with others.
            </p>
            <Button
              onClick={() => navigate('/quizzes/new')}
              className="inline-flex items-center"
            >
              <PlusIcon className="w-5 h-5 mr-2" />
              Create Your First Quiz
            </Button>
          </div>
        ) : (
          <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <ul className="divide-y divide-gray-200">
              {quizzes.map((quiz) => (
                <li key={quiz.id} className="transition-colors">
                  <div className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 hover:text-primary-600">
                          <Link to={`/quizzes/${quiz.id}`}>{quiz.title}</Link>
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">{quiz.topic}</p>
                        <div className="flex items-center mt-2 text-xs text-gray-500">
                          <span className="mr-4">
                            Created: {formatDate(quiz.created_at)}
                          </span>
                          <span className="mr-4">
                            Questions: {quiz.questions?.length || 0}
                          </span>
                          {quiz.document_sources && (
                            <span>
                              Sources: {quiz.document_sources.document_ids?.length || 0} documents
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => toggleExpand(quiz.id)}
                          className="text-gray-500 hover:text-gray-700 p-1 rounded-full"
                          aria-label="Expand quiz details"
                        >
                          <ChevronDownIcon 
                            className={`w-5 h-5 transition-transform ${
                              expandedQuizId === quiz.id ? 'transform rotate-180' : ''
                            }`} 
                          />
                        </button>
                        
                        <Link
                          to={`/quizzes/${quiz.id}`}
                          className="text-primary-600 hover:text-primary-800 p-1 rounded-full"
                          aria-label="Edit quiz"
                        >
                          <PencilIcon className="w-5 h-5" />
                        </Link>
                        
                        <Link
                          to={`/quizzes/${quiz.id}/preview`}
                          className="text-green-600 hover:text-green-800 p-1 rounded-full"
                          aria-label="Preview quiz"
                        >
                          <EyeIcon className="w-5 h-5" />
                        </Link>
                        
                        <button
                          onClick={() => setDeleteConfirmId(quiz.id)}
                          className="text-red-500 hover:text-red-700 p-1 rounded-full"
                          aria-label="Delete quiz"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    
                    {/* Expanded details */}
                    {expandedQuizId === quiz.id && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-md">
                        <div className="text-sm">
                          <p className="mb-2">
                            {quiz.description || 'No description available.'}
                          </p>
                          {quiz.questions?.length > 0 && (
                            <div className="mt-4">
                              <h4 className="font-medium mb-2">Questions:</h4>
                              <ul className="space-y-1 pl-4 list-disc">
                                {quiz.questions.slice(0, 3).map(question => (
                                  <li key={question.id} className="text-gray-700">
                                    {question.question_text.length > 100 
                                      ? question.question_text.substring(0, 100) + '...' 
                                      : question.question_text}
                                  </li>
                                ))}
                                {quiz.questions.length > 3 && (
                                  <li className="text-primary-600">
                                    +{quiz.questions.length - 3} more questions
                                  </li>
                                )}
                              </ul>
                            </div>
                          )}
                        </div>
                        <div className="mt-4 flex justify-end">
                          <Link to={`/quizzes/${quiz.id}`}>
                            <Button size="sm" variant="outline">View Full Quiz</Button>
                          </Link>
                        </div>
                      </div>
                    )}
                    
                    {/* Delete confirmation */}
                    {deleteConfirmId === quiz.id && (
                      <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
                        <p className="text-red-700 mb-3">
                          Are you sure you want to delete this quiz? This action cannot be undone.
                        </p>
                        <div className="flex justify-end space-x-3">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setDeleteConfirmId(null)}
                          >
                            Cancel
                          </Button>
                          <Button 
                            size="sm" 
                            variant="danger"
                            onClick={() => handleDeleteQuiz(quiz.id)}
                            disabled={loading}
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

export default QuizList;