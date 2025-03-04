// frontend/src/components/quiz/QuizSummaryPanel.jsx
import React from 'react';

const QuizSummaryPanel = ({ quiz, formatDate }) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 mt-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Quiz Summary</h2>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Total Questions:</span>
          <span className="font-semibold">{quiz.questions.length}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Multiple Choice:</span>
          <span className="font-semibold">
            {quiz.questions.filter(q => q.question_type === 'multiple_choice').length}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">True/False:</span>
          <span className="font-semibold">
            {quiz.questions.filter(q => q.question_type === 'boolean').length}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Last Updated:</span>
          <span className="font-semibold">{formatDate(quiz.updated_at)}</span>
        </div>
      </div>
    </div>
  );
};

export default QuizSummaryPanel;