// frontend/src/components/quiz/AnswerOptions.jsx
import React from 'react';

const AnswerOptions = ({ 
  question, 
  selectedAnswer, 
  onAnswerSelect, 
  showCorrect = false, 
  disabled = false 
}) => {
  const handleAnswerSelect = (answerId) => {
    if (!disabled && onAnswerSelect) {
      onAnswerSelect(answerId);
    }
  };

  const getAnswerClass = (answer) => {
    const baseClass = "p-3 border rounded-lg mb-2 cursor-pointer transition-colors";
    
    if (!showCorrect && selectedAnswer === answer.id) {
      return `${baseClass} bg-blue-100 border-blue-400`;
    }
    
    if (showCorrect) {
      if (answer.is_correct) {
        return `${baseClass} bg-green-100 border-green-400`;
      }
      if (selectedAnswer === answer.id && !answer.is_correct) {
        return `${baseClass} bg-red-100 border-red-400`;
      }
    }
    
    return `${baseClass} hover:bg-gray-100`;
  };

  const getBooleanClass = (answer) => {
    const baseClass = 'inline-flex items-center justify-center px-4 py-2 border rounded-md text-center mr-2 min-w-[100px]';
    
    if (!showCorrect && selectedAnswer === answer.id) {
      return `${baseClass} bg-blue-100 border-blue-400`;
    }
    
    if (showCorrect) {
      if (answer.is_correct) {
        return `${baseClass} bg-green-100 border-green-400`;
      }
      if (selectedAnswer === answer.id && !answer.is_correct) {
        return `${baseClass} bg-red-100 border-red-400`;
      }
    }
    
    return `${baseClass} hover:bg-gray-100`;
  };

  // Sort answers by position to ensure consistent order
  const sortedAnswers = [...question.answers].sort((a, b) => a.position - b.position);

  return (
    <div className="mt-4">
      {question.question_type === 'boolean' ? (
        <div className="flex flex-wrap gap-2">
          {sortedAnswers.map((answer) => (
            <button
              key={answer.id}
              onClick={() => handleAnswerSelect(answer.id)}
              className={getBooleanClass(answer)}
              disabled={disabled}
            >
              {answer.answer_text}
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {sortedAnswers.map((answer) => (
            <div
              key={answer.id}
              onClick={() => handleAnswerSelect(answer.id)}
              className={getAnswerClass(answer)}
            >
              <div className="flex items-start">
                <div className="mr-3 mt-0.5">
                  <div className={`w-5 h-5 border rounded-full flex items-center justify-center ${
                    selectedAnswer === answer.id ? 'border-blue-500 bg-blue-500' : 'border-gray-400'
                  }`}>
                    {selectedAnswer === answer.id && (
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    )}
                  </div>
                </div>
                <div>{answer.answer_text}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {showCorrect && question.explanation && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-lg">
          <div className="text-sm font-medium text-blue-800 mb-1">Explanation:</div>
          <div className="text-sm text-blue-700">{question.explanation}</div>
        </div>
      )}
    </div>
  );
};

export default AnswerOptions;