// frontend/src/components/quiz/QuestionEditor.jsx
import React, { useState } from 'react';
import useAppStore from '../../store/appStore';
import Button from '../common/Button';

const QuestionEditor = ({ quizId, question, onClose }) => {
  const { 
    regenerateQuestion, 
    convertQuestionType, 
    isLoading 
  } = useAppStore();

  const [questionText, setQuestionText] = useState(question.question_text);
  const [questionType, setQuestionType] = useState(question.question_type);
  const [explanation, setExplanation] = useState(question.explanation);
  const [answers, setAnswers] = useState(question.answers);
  const [isEditing, setIsEditing] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const handleQuestionChange = (e) => {
    setQuestionText(e.target.value);
    setIsDirty(true);
  };

  const handleExplanationChange = (e) => {
    setExplanation(e.target.value);
    setIsDirty(true);
  };

  const handleAnswerTextChange = (index, value) => {
    const newAnswers = [...answers];
    newAnswers[index].answer_text = value;
    setAnswers(newAnswers);
    setIsDirty(true);
  };

  const handleCorrectAnswerChange = (index) => {
    const newAnswers = answers.map((answer, i) => ({
      ...answer,
      is_correct: i === index
    }));
    setAnswers(newAnswers);
    setIsDirty(true);
  };

  const handleAddAnswer = () => {
    if (questionType === 'multiple_choice' && answers.length < 8) {
      setAnswers([
        ...answers,
        {
          answer_text: `Option ${answers.length + 1}`,
          is_correct: false,
          position: answers.length
        }
      ]);
      setIsDirty(true);
    }
  };

  const handleRemoveAnswer = (index) => {
    if (answers.length > 2) {
      // Make sure we still have a correct answer
      const isRemovingCorrect = answers[index].is_correct;
      let newAnswers = answers.filter((_, i) => i !== index);
      
      if (isRemovingCorrect && newAnswers.length > 0) {
        newAnswers[0].is_correct = true;
      }
      
      // Update positions
      newAnswers = newAnswers.map((answer, i) => ({
        ...answer,
        position: i
      }));
      
      setAnswers(newAnswers);
      setIsDirty(true);
    }
  };

  const handleSave = () => {
    // In a real implementation, this would call an API to update the question
    // For now, we'll just tell the parent component we're done
    onClose({
      ...question,
      question_text: questionText,
      question_type: questionType,
      explanation: explanation,
      answers: answers
    });
  };

  const handleRegenerate = async () => {
    await regenerateQuestion(quizId, question.id);
    onClose(); // Close after regeneration
  };

  const handleTypeChange = async (newType) => {
    if (newType !== questionType) {
      await convertQuestionType(quizId, question.id, newType);
      onClose(); // Close after conversion
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Edit Question</h2>
        <button 
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Question Type
          </label>
          <div className="flex space-x-2">
            <Button
              onClick={() => handleTypeChange('boolean')}
              variant={questionType === 'boolean' ? 'primary' : 'secondary'}
            >
              True/False
            </Button>
            <Button
              onClick={() => handleTypeChange('multiple_choice')}
              variant={questionType === 'multiple_choice' ? 'primary' : 'secondary'}
            >
              Multiple Choice
            </Button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Question Text
          </label>
          <textarea
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows="3"
            value={questionText}
            onChange={handleQuestionChange}
            placeholder="Enter your question"
          />
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700">
              Answer Options
            </label>
            {questionType === 'multiple_choice' && (
              <Button
                onClick={handleAddAnswer}
                variant="link"
                size="sm"
                disabled={answers.length >= 8}
              >
                + Add Option
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {answers.map((answer, index) => (
              <div key={index} className="flex items-center space-x-2">
                <input
                  type={questionType === 'boolean' ? 'radio' : 'radio'}
                  className="h-4 w-4 text-blue-600"
                  checked={answer.is_correct}
                  onChange={() => handleCorrectAnswerChange(index)}
                  name={`answer-${question.id}`}
                />
                <input
                  type="text"
                  className="flex-1 p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={answer.answer_text}
                  onChange={(e) => handleAnswerTextChange(index, e.target.value)}
                />
                {questionType === 'multiple_choice' && answers.length > 2 && (
                  <button
                    onClick={() => handleRemoveAnswer(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Explanation
          </label>
          <textarea
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows="3"
            value={explanation}
            onChange={handleExplanationChange}
            placeholder="Explain why the correct answer is right"
          />
        </div>

        <div className="flex justify-between pt-4 border-t">
          <div className="space-x-2">
            <Button
              onClick={handleRegenerate}
              variant="secondary"
              disabled={isLoading}
            >
              {isLoading ? 'Regenerating...' : 'Regenerate Question'}
            </Button>
          </div>
          <div className="space-x-2">
            <Button
              onClick={onClose}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              variant="primary"
              disabled={!isDirty}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestionEditor;