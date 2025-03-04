// frontend/src/components/quiz/QuizSettingsPanel.jsx
// Updated to match the Question Bank styling

import React from 'react';
import Button from '../common/Button';
import { ChevronUpIcon, AdjustmentsHorizontalIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';

const QuizSettingsPanel = ({ 
  quizForm, 
  handleInputChange, 
  handleSaveQuiz, 
  expandedSettings, 
  setExpandedSettings, 
  currentQuiz,
  isLoading 
}) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800 flex items-center">
          <Cog6ToothIcon className="h-5 w-5 text-primary-600 mr-2" />
          Quiz Settings
        </h2>
        <button
          onClick={() => setExpandedSettings(!expandedSettings)}
          className="text-gray-500 hover:text-gray-700"
        >
          {expandedSettings ? (
            <ChevronUpIcon className="h-5 w-5" />
          ) : (
            <AdjustmentsHorizontalIcon className="h-5 w-5" />
          )}
        </button>
      </div>
      
      {expandedSettings ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quiz Title
            </label>
            <input
              type="text"
              name="title"
              value={quizForm.title}
              onChange={handleInputChange}
              className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Topic
            </label>
            <input
              type="text"
              name="topic"
              value={quizForm.topic}
              onChange={handleInputChange}
              className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              name="description"
              value={quizForm.description}
              onChange={handleInputChange}
              className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
              rows="3"
            />
          </div>
          
          <div className="pt-2">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="use_default_prompt"
                name="use_default_prompt"
                checked={quizForm.use_default_prompt}
                onChange={handleInputChange}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="use_default_prompt" className="ml-2 block text-sm text-gray-700">
                Use default system prompt
              </label>
            </div>
            
            {!quizForm.use_default_prompt && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custom Prompt
                </label>
                <textarea
                  name="custom_prompt"
                  value={quizForm.custom_prompt}
                  onChange={handleInputChange}
                  rows="4"
                  placeholder="Enter a custom system prompt for quiz generation"
                  className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            )}
          </div>
          
          <div className="pt-4">
            <Button
              onClick={handleSaveQuiz}
              variant="primary"
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Saving...' : 'Save Quiz Settings'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div>
            <span className="text-sm font-medium text-gray-500">Title:</span>
            <p className="text-gray-900">{currentQuiz.title}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-500">Topic:</span>
            <p className="text-gray-900">{currentQuiz.topic}</p>
          </div>
          {currentQuiz.description && (
            <div>
              <span className="text-sm font-medium text-gray-500">Description:</span>
              <p className="text-gray-900">{currentQuiz.description}</p>
            </div>
          )}
          {currentQuiz.document_sources && currentQuiz.document_sources.document_ids?.length > 0 && (
            <div>
              <span className="text-sm font-medium text-gray-500">Source Documents:</span>
              <p className="text-gray-900">{currentQuiz.document_sources.document_ids.length} documents</p>
            </div>
          )}
          <div className="mt-4">
            <Button
              onClick={() => setExpandedSettings(true)}
              variant="outline"
              size="sm"
              className="w-full"
            >
              Edit Settings
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizSettingsPanel;