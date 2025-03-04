// frontend/src/components/quiz/QuestionItem.jsx
// Updated to match the style of the Question Bank

import React from 'react';
import Button from '../common/Button';
import {
  PencilIcon,
  TrashIcon,
  ArrowPathIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ArrowUturnLeftIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

const QuestionItem = ({
  question,
  index,
  expandedQuestionId,
  confirmDeleteId,
  toggleQuestionExpand,
  handleStartEditQuestion,
  handleRegenerateQuestion,
  setConfirmDeleteId,
  handleChangeQuestionType,
  handleDeleteQuestion,
  handleRevertQuestion,
  handleViewQuestionHistory
}) => {
  return (
    <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center mb-2">
              <span className="bg-gray-100 text-gray-700 rounded-full w-6 h-6 flex items-center justify-center mr-2">
                {index + 1}
              </span>
              <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                  question.question_type === 'multiple_choice'
                    ? 'bg-purple-100 text-purple-700'
                    : question.question_type === 'boolean'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-green-100 text-green-700'
              }`}>
                {question.question_type === 'multiple_choice' 
                  ? 'Multiple Choice' 
                  : question.question_type === 'boolean'
                    ? 'True/False'
                    : 'Open-Ended'}
              </span>
            </div>
            
            <h3 className="text-lg font-medium text-gray-900">{question.question_text}</h3>
          </div>
          
          <div className="flex items-center space-x-2 ml-4">
            <button
              onClick={() => toggleQuestionExpand(question.id)}
              className="p-1 text-gray-500 hover:text-gray-700 rounded"
            >
              {expandedQuestionId === question.id ? (
                <ChevronUpIcon className="h-5 w-5" />
              ) : (
                <ChevronDownIcon className="h-5 w-5" />
              )}
            </button>
            <button
              onClick={() => handleStartEditQuestion(question.id)}
              className="p-1 text-blue-600 hover:text-blue-800 rounded"
            >
              <PencilIcon className="h-5 w-5" />
            </button>
            <button
              onClick={() => handleRegenerateQuestion(question.id)}
              className="p-1 text-green-600 hover:text-green-800 rounded"
            >
              <ArrowPathIcon className="h-5 w-5" />
            </button>
            <button
              onClick={() => setConfirmDeleteId(question.id)}
              className="p-1 text-red-500 hover:text-red-700 rounded"
            >
              <TrashIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        {/* Expanded content showing answers */}
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
            
            <div className="mt-4 flex justify-end space-x-2">
              <Button
                onClick={() => handleChangeQuestionType(
                  question.id, 
                  question.question_type === 'multiple_choice' ? 'boolean' : 'multiple_choice'
                )}
                variant="outline"
                size="sm"
              >
                Convert to {question.question_type === 'multiple_choice' ? 'True/False' : 'Multiple Choice'}
              </Button>
              <Button
                onClick={() => handleStartEditQuestion(question.id)}
                variant="primary"
                size="sm"
              >
                Edit Question
              </Button>
            </div>
          </div>
        )}
        
        {/* Delete confirmation */}
        {confirmDeleteId === question.id && (
          <div className="mt-4 p-4 bg-red-50 border-t border-red-200">
            <p className="text-red-700 mb-3">
              Are you sure you want to delete this question?
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
                onClick={() => handleDeleteQuestion(question.id)}
              >
                Delete
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionItem;