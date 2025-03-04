// frontend/src/components/quiz/QuestionsList.jsx
import React, { useState, useRef } from 'react';
import {
  PencilIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowPathIcon,
  ClockIcon,
  ArrowUturnLeftIcon
} from '@heroicons/react/24/outline';
import QuestionEditor from './QuestionEditor';
import AnswerOptions from './AnswerOptions';
import Button from '../common/Button';
import QuestionHistory from './QuestionHistory';
import { revertQuestion } from '../../services/api';
import { toast } from 'react-hot-toast';
import useOutsideClick from '../../hooks/useOutsideClick';

const QuestionsList = ({
  questions,
  editingQuestionId,
  expandedQuestionId, // can be 'all' to expand all
  confirmDeleteId,
  editingQuestionRef,
  toggleQuestionExpand,
  handleStartEditQuestion,
  handleRegenerateQuestion,
  setConfirmDeleteId,
  handleChangeQuestionType,
  handleDeleteQuestion,
  handleCancelEditQuestion,
  handleSaveQuestion,
  isGenerating,
  quizId,
  regeneratingQuestions = {}
}) => {
  const [showHistoryId, setShowHistoryId] = useState(null);
  const [isReverting, setIsReverting] = useState(false);
  
  // References for detecting outside clicks
  const historyModalRef = useRef(null);
  const editorRef = useRef(null);
  
  // Configure outside click handlers
  useOutsideClick(historyModalRef, () => setShowHistoryId(null), showHistoryId !== null);
  useOutsideClick(editorRef, handleCancelEditQuestion, editingQuestionId !== null);

  // Handle showing question history
  const handleShowHistory = (questionId, e) => {
    e.stopPropagation(); // Prevent expanding/collapsing the question
    setShowHistoryId(questionId);
  };

  // Handle quick revert to previous version (without showing history)
  const handleQuickRevert = async (question, e) => {
    e.stopPropagation(); // Prevent expanding/collapsing the question
    
    setIsReverting(true);
    try {
      // The API will revert to the most recent history entry when historyId is not provided
      const revertedQuestion = await revertQuestion(question.quiz_id, question.id);
      toast.success('Question reverted to previous version');
      
      // Handle the reverted question
      if (handleSaveQuestion) {
        handleSaveQuestion(question.id, revertedQuestion);
      }
    } catch (error) {
      toast.error('Failed to revert question');
      console.error(error);
    } finally {
      setIsReverting(false);
    }
  };

  // Handle the successful revert from history component
  const handleHistoryRevert = (revertedQuestion) => {
    if (handleSaveQuestion && revertedQuestion) {
      handleSaveQuestion(revertedQuestion.id, revertedQuestion);
    }
  };

  return (
    <div className="space-y-4">
      {questions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No questions yet. Add your first question to get started.</p>
        </div>
      ) : (
        questions.map((question, index) => {
          const isThisQuestionRegenerating = regeneratingQuestions[question.id];
          const isQuestionDisabled = isGenerating || isThisQuestionRegenerating;
          
          return (
            <div 
              key={question.id}
              className={`border rounded-lg overflow-hidden ${
                editingQuestionId === question.id 
                  ? 'border-primary-300 shadow-md' 
                  : 'border-gray-200'
              }`}
              ref={editingQuestionId === question.id ? editingQuestionRef : null}
            >
              {/* Question header */}
              <div 
                className={`p-4 flex justify-between items-start cursor-pointer ${
                  expandedQuestionId === question.id || expandedQuestionId === 'all' 
                    ? 'bg-gray-50' 
                    : 'bg-white'
                }`}
                onClick={() => toggleQuestionExpand(question.id)}
              >
                <div className="flex items-center">
                  <span className="bg-gray-100 text-gray-700 rounded-full w-6 h-6 flex items-center justify-center mr-3">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-gray-900 font-medium">{question.question_text}</p>
                    <span className="text-xs text-gray-500 mt-1 inline-block">
                      {question.question_type === 'multiple_choice' 
                        ? 'Multiple Choice' 
                        : question.question_type === 'boolean'
                          ? 'True/False'
                          : 'Open-Ended'}
                    </span>
                  </div>
                </div>
                
                <div className="flex space-x-1">
                  {!editingQuestionId && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEditQuestion(question.id);
                        }}
                        className={`p-1 rounded ${
                          isQuestionDisabled 
                            ? 'text-gray-400 cursor-not-allowed'
                            : 'text-gray-500 hover:text-primary-600 hover:bg-gray-100'
                        }`}
                        title="Edit question"
                        disabled={isQuestionDisabled}
                      >
                        <PencilIcon className="h-5 w-5" />
                      </button>
                      
                      <button
                        onClick={(e) => handleShowHistory(question.id, e)}
                        className={`p-1 rounded ${
                          isQuestionDisabled 
                            ? 'text-gray-400 cursor-not-allowed'
                            : 'text-gray-500 hover:text-primary-600 hover:bg-gray-100'
                        }`}
                        title="View history"
                        disabled={isQuestionDisabled}
                      >
                        <ClockIcon className="h-5 w-5" />
                      </button>
                      
                      <button
                        onClick={(e) => handleQuickRevert(question, e)}
                        className={`p-1 rounded ${
                          isQuestionDisabled || isReverting
                            ? 'text-gray-400 cursor-not-allowed bg-gray-100'
                            : 'text-gray-500 hover:text-primary-600 hover:bg-gray-100'
                        }`}
                        title="Revert to previous version"
                        disabled={isQuestionDisabled || isReverting}
                      >
                        <ArrowUturnLeftIcon className={`h-5 w-5 ${
                          isReverting ? 'animate-spin text-primary-600' : ''
                        }`} />
                      </button>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRegenerateQuestion(question.id);
                        }}
                        className={`p-1 rounded ${
                          isQuestionDisabled
                            ? 'text-gray-400 bg-gray-100 cursor-not-allowed'
                            : 'text-gray-500 hover:text-primary-600 hover:bg-gray-100'
                        }`}
                        title="Regenerate question"
                        disabled={isQuestionDisabled}
                      >
                        <ArrowPathIcon className={`h-5 w-5 ${
                          isThisQuestionRegenerating ? 'animate-spin text-primary-600' : ''
                        }`} />
                      </button>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(question.id);
                        }}
                        className={`p-1 rounded ${
                          isQuestionDisabled
                            ? 'text-gray-400 cursor-not-allowed'
                            : 'text-gray-500 hover:text-red-600 hover:bg-gray-100'
                        }`}
                        title="Delete question"
                        disabled={isQuestionDisabled}
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                      
                      {(expandedQuestionId === question.id || expandedQuestionId === 'all') ? (
                        <ChevronUpIcon className="h-5 w-5 text-gray-500" />
                      ) : (
                        <ChevronDownIcon className="h-5 w-5 text-gray-500" />
                      )}
                    </>
                  )}
                </div>
              </div>
              
              {/* Question content when expanded */}
              {(expandedQuestionId === question.id || expandedQuestionId === 'all') && !editingQuestionId && (
                <div className="p-4 border-t border-gray-200 bg-white">
                  {/* Answers display */}
                  <div className="mt-2">
                    {question.question_type === 'open_ended' ? (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Correct Answer:</h4>
                        <div className="bg-green-50 border border-green-100 p-3 rounded-md text-green-800">
                          {question.correct_answer || question.explanation || "No correct answer provided"}
                        </div>
                      </div>
                    ) : (
                      <AnswerOptions 
                        question={question} 
                        showCorrect={true} 
                        disabled={true} 
                      />
                    )}
                  </div>
                  
                  {/* Only show question type info as text, no buttons */}
                  <div className="mt-4">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Question Type:</span> {
                        question.question_type === 'multiple_choice' 
                          ? 'Multiple Choice' 
                          : question.question_type === 'boolean'
                            ? 'True/False'
                            : 'Open-Ended'
                      }
                    </p>
                  </div>
                </div>
              )}
              
              {/* Editing mode */}
              {editingQuestionId === question.id && (
                <div ref={editorRef}>
                  <QuestionEditor 
                    question={question}
                    onSave={(updatedData) => handleSaveQuestion(question.id, updatedData)}
                    onCancel={handleCancelEditQuestion}
                  />
                </div>
              )}
              
              {/* Delete confirmation */}
              {confirmDeleteId === question.id && (
                <div className="p-4 border-t border-gray-200 bg-red-50">
                  <p className="text-red-700 mb-3">
                    Are you sure you want to delete this question? This action cannot be undone.
                  </p>
                  <div className="flex justify-end space-x-3">
                    <Button 
                      onClick={() => setConfirmDeleteId(null)} 
                      variant="outline"
                      size="sm"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={() => handleDeleteQuestion(question.id)} 
                      variant="danger"
                      size="sm"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Question History Modal */}
      {showHistoryId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div ref={historyModalRef} className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] flex flex-col">
            <QuestionHistory 
              quizId={quizId}
              questionId={showHistoryId}
              onRevert={handleHistoryRevert}
              onClose={() => setShowHistoryId(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionsList;