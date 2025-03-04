// frontend/src/components/quiz/QuizPreview.jsx
import React, { useState } from 'react';
import AnswerOptions from './AnswerOptions';
import Button from '../common/Button';

const QuizPreview = ({ quiz, onEdit }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);

  // Sort questions by position
  const sortedQuestions = [...quiz.questions].sort((a, b) => a.position - b.position);
  
  const currentQuestion = sortedQuestions[currentQuestionIndex];
  const totalQuestions = sortedQuestions.length;
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;
  const allQuestionsAnswered = Object.keys(userAnswers).length === totalQuestions;

  const handleAnswerSelect = (answerId) => {
    if (showResults) return; // Don't allow changing answers after viewing results
    
    setUserAnswers({
      ...userAnswers,
      [currentQuestion.id]: answerId
    });
  };

  const handleNextQuestion = () => {
    if (isLastQuestion) {
      setShowResults(true);
    } else {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleJumpToQuestion = (index) => {
    setCurrentQuestionIndex(index);
  };

  const handleReset = () => {
    setUserAnswers({});
    setCurrentQuestionIndex(0);
    setShowResults(false);
  };

  const handleEditQuestion = () => {
    if (onEdit && currentQuestion) {
      onEdit(currentQuestion);
    }
  };

  const calculateScore = () => {
    let correctCount = 0;
    
    Object.entries(userAnswers).forEach(([questionId, answerId]) => {
      const question = quiz.questions.find(q => q.id.toString() === questionId.toString());
      if (question) {
        const selectedAnswer = question.answers.find(a => a.id.toString() === answerId.toString());
        if (selectedAnswer && selectedAnswer.is_correct) {
          correctCount++;
        }
      }
    });
    
    return {
      correct: correctCount,
      total: totalQuestions,
      percentage: Math.round((correctCount / totalQuestions) * 100)
    };
  };

  const renderQuestionStatus = (index) => {
    const question = sortedQuestions[index];
    const isActive = index === currentQuestionIndex;
    const isAnswered = question && userAnswers[question.id] !== undefined;
    
    let statusClass = 'w-8 h-8 rounded-full flex items-center justify-center text-sm';
    
    if (isActive) {
      statusClass += ' bg-blue-600 text-white';
    } else if (isAnswered) {
      statusClass += ' bg-gray-200 text-gray-700';
    } else {
      statusClass += ' bg-gray-100 text-gray-500 border border-gray-300';
    }
    
    return (
      <button
        key={index}
        className={statusClass}
        onClick={() => handleJumpToQuestion(index)}
      >
        {index + 1}
      </button>
    );
  };

  const renderProgressBar = () => {
    const answeredCount = Object.keys(userAnswers).length;
    const progress = (answeredCount / totalQuestions) * 100;
    
    return (
      <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
        <div
          className="bg-blue-600 h-full"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    );
  };

  const renderResults = () => {
    const score = calculateScore();
    
    return (
      <div className="bg-white rounded-lg p-6 border shadow-sm">
        <h2 className="text-xl font-bold mb-4">Quiz Results</h2>
        
        <div className="text-center py-4 mb-4">
          <div className="text-5xl font-bold text-blue-600 mb-2">{score.percentage}%</div>
          <div className="text-gray-600">
            You got {score.correct} out of {score.total} questions correct
          </div>
        </div>
        
        <div className="space-y-4 mb-6">
          {sortedQuestions.map((question, index) => {
            const userAnswerId = userAnswers[question.id];
            const userAnswer = userAnswerId 
              ? question.answers.find(a => a.id.toString() === userAnswerId.toString()) 
              : null;
            const correctAnswer = question.answers.find(a => a.is_correct);
            const isCorrect = userAnswer && userAnswer.is_correct;
            
            return (
              <div key={question.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center">
                    <span className="font-semibold mr-2">Question {index + 1}:</span>
                    {isCorrect ? (
                      <span className="text-green-600 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Correct
                      </span>
                    ) : (
                      <span className="text-red-600 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        Incorrect
                      </span>
                    )}
                  </div>
                  <button 
                    onClick={() => handleJumpToQuestion(index)}
                    className="text-blue-600 text-sm hover:underline"
                  >
                    Review
                  </button>
                </div>
                
                <div className="mt-2">{question.question_text}</div>
                
                {userAnswer && (
                  <div className="mt-3">
                    <div className="text-sm text-gray-600">Your answer:</div>
                    <div className={`mt-1 p-2 rounded ${isCorrect ? 'bg-green-100' : 'bg-red-100'}`}>
                      {userAnswer.answer_text}
                    </div>
                  </div>
                )}
                
                {!isCorrect && correctAnswer && (
                  <div className="mt-3">
                    <div className="text-sm text-gray-600">Correct answer:</div>
                    <div className="mt-1 p-2 bg-green-100 rounded">
                      {correctAnswer.answer_text}
                    </div>
                  </div>
                )}
                
                {question.explanation && (
                  <div className="mt-3 text-sm border-t pt-2">
                    <div className="font-medium">Explanation:</div>
                    <div>{question.explanation}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        <div className="flex justify-between">
          <Button
            onClick={handleReset}
            variant="secondary"
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  };

  if (!currentQuestion) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No questions found in this quiz.</p>
      </div>
    );
  }

  if (showResults) {
    return renderResults();
  }

  return (
    <div className="bg-white rounded-lg p-6 border shadow-sm">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-semibold">{quiz.title}</h2>
          <div className="text-sm text-gray-600">
            Question {currentQuestionIndex + 1} of {totalQuestions}
          </div>
        </div>
        {renderProgressBar()}
      </div>
      
      <div className="mb-4 flex justify-between items-center">
        <div className="flex space-x-2">
          {Array.from({ length: totalQuestions }).map((_, index) => 
            renderQuestionStatus(index)
          )}
        </div>
        
        {onEdit && (
          <Button
            onClick={handleEditQuestion}
            variant="outline"
            size="sm"
          >
            Edit Question
          </Button>
        )}
      </div>
      
      <div className="py-4">
        <h3 className="text-lg font-medium mb-2">{currentQuestion.question_text}</h3>
        
        <AnswerOptions
          question={currentQuestion}
          selectedAnswer={userAnswers[currentQuestion.id]}
          onAnswerSelect={handleAnswerSelect}
          showCorrect={false}
        />
      </div>
      
      <div className="flex justify-between pt-4 border-t">
        <Button
          onClick={handlePrevQuestion}
          variant="secondary"
          disabled={currentQuestionIndex === 0}
        >
          Previous
        </Button>
        
        <Button
          onClick={handleNextQuestion}
          variant="primary"
          disabled={!userAnswers[currentQuestion.id]}
        >
          {isLastQuestion ? 'Finish Quiz' : 'Next Question'}
        </Button>
      </div>
    </div>
  );
};

export default QuizPreview;