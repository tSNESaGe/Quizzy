// frontend/src/components/quiz/QuestionEditor.jsx
// Updated to match the Question Bank styling

import React, { useState, useEffect } from 'react';
import Button from '../common/Button';
import { TrashIcon, PlusCircleIcon } from '@heroicons/react/24/outline';

const QuestionEditor = ({ question, onSave, onCancel, isNew = false }) => {
  const [questionData, setQuestionData] = useState({
    question_text: '',
    question_type: 'multiple_choice',
    explanation: '',
    answers: [],
    correct_answer: '' // Field for open-ended questions
  });  

  // Initialize questionData when the question prop changes
  useEffect(() => {
    if (question) {
      setQuestionData({
        question_text: question.question_text || '',
        question_type: question.question_type || 'multiple_choice',
        explanation: question.explanation || '',
        answers: [...(question.answers || [])],
        correct_answer: question.correct_answer || question.explanation || '' // Use explanation as fallback
      });
    }
  }, [question]);

  const handleQuestionChange = (e) => {
    const { name, value } = e.target;
    setQuestionData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAnswerChange = (index, field, value) => {
    const newAnswers = [...questionData.answers];
    newAnswers[index] = {
      ...newAnswers[index],
      [field]: value
    };
    setQuestionData(prev => ({ ...prev, answers: newAnswers }));
  };

  const handleCorrectAnswerChange = (e) => {
    setQuestionData(prev => ({
      ...prev,
      correct_answer: e.target.value
    }));
  };

  const handleCorrectAnswerSelect = (index) => {
    const newAnswers = questionData.answers.map((answer, i) => ({
      ...answer,
      is_correct: i === index
    }));
    
    setQuestionData(prev => ({
      ...prev,
      answers: newAnswers
    }));
  };

  const handleSave = () => {
    // Validate the data
    if (questionData.question_text.trim() === '') {
      alert('Question text cannot be empty');
      return;
    }
  
    // Prepare the data to send
    const dataToSave = {
      question_text: questionData.question_text,
      question_type: questionData.question_type,
      explanation: questionData.explanation,
    };
  
    // For multiple choice and boolean questions
    if (questionData.question_type === 'multiple_choice' || questionData.question_type === 'boolean') {
      // Remove empty answer options from multiple choice questions
      if (questionData.question_type === 'multiple_choice') {
        const nonEmptyAnswers = questionData.answers.filter(
          answer => answer.answer_text.trim() !== ''
        );
        
        // Ensure there are at least 2 non-empty answers
        if (nonEmptyAnswers.length < 2) {
          alert('Please provide at least 2 answer options');
          return;
        }
        
        // Make sure at least one answer is marked as correct
        if (!nonEmptyAnswers.some(answer => answer.is_correct)) {
          nonEmptyAnswers[0].is_correct = true;
        }
        
        // Update answer positions
        const updatedAnswers = nonEmptyAnswers.map((answer, index) => ({
          ...answer,
          position: index
        }));
        
        dataToSave.answers = updatedAnswers;
      } else {
        // For boolean questions, include the answers
        dataToSave.answers = questionData.answers;
      }
      
      // Make sure at least one answer is marked as correct
      if (dataToSave.answers && !dataToSave.answers.some(answer => answer.is_correct)) {
        alert('Please select a correct answer');
        return;
      }
    } 
    // For open-ended questions
    else if (questionData.question_type === 'open_ended') {
      // Include the correct answer
      dataToSave.correct_answer = questionData.correct_answer;
      dataToSave.answers = []; // Empty array for backend
    }
  
    // Call the parent save function
    onSave(dataToSave);
  };

  const addAnswerOption = () => {
    if (questionData.answers.length >= 6) return;
    
    setQuestionData(prev => ({
      ...prev,
      answers: [
        ...prev.answers,
        {
          answer_text: '',
          is_correct: prev.answers.length === 0,
          position: prev.answers.length
        }
      ]
    }));
  };

  const removeAnswerOption = (index) => {
    const newAnswers = questionData.answers.filter((_, i) => i !== index);
    
    // If the correct answer is being removed, select the first one as correct
    if (questionData.answers[index].is_correct && newAnswers.length > 0) {
      newAnswers[0].is_correct = true;
    }
    
    setQuestionData(prev => ({ ...prev, answers: newAnswers }));
  };

  // Adjust answers when question type changes
  useEffect(() => {
    if (questionData.question_type === 'boolean') {
      setQuestionData(prev => {
        // Preserve previous question text and explanation
        // Find if there is already a correct answer
        const hasCorrectAnswer = prev.answers.some(a => a.is_correct);
        // Default to first answer (True) being correct if none is set
        const trueIsCorrect = hasCorrectAnswer 
          ? prev.answers.find(a => a.is_correct)?.answer_text === 'True'
          : true;
          
        // Preserve correct_answer from previous data if type was open_ended
        const correctAnswer = prev.correct_answer || prev.explanation || '';
        
        return {
          ...prev,
          // Keep question text and explanation
          question_text: prev.question_text,
          explanation: prev.explanation,
          // Set correct_answer from previous state
          correct_answer: correctAnswer,
          answers: [
            { answer_text: 'True', is_correct: trueIsCorrect, position: 0 },
            { answer_text: 'False', is_correct: !trueIsCorrect, position: 1 }
          ]
        };
      });
    } else if (questionData.question_type === 'multiple_choice') {
      setQuestionData(prev => {
        // Preserve correct_answer from previous data if type was open_ended
        const correctAnswer = prev.correct_answer || prev.explanation || '';
        
        // If switching from boolean, keep True/False but add more options
        let updatedAnswers = [...(prev.answers || [])];
        if (prev.question_type === 'boolean') {
          // Keep True/False as first two options, but add more
          const existingAnswers = [
            ...prev.answers.map((a, i) => ({...a, position: i}))
          ];
          
          // Add more options to reach at least 4
          while (updatedAnswers.length < 4) {
            updatedAnswers.push({ 
              answer_text: `Option ${updatedAnswers.length + 1}`, 
              is_correct: false, 
              position: updatedAnswers.length 
            });
          }
        } else if (updatedAnswers.length < 2) {
          // If no answers yet, add default options
          updatedAnswers = [
            { answer_text: 'Option 1', is_correct: true, position: 0 },
            { answer_text: 'Option 2', is_correct: false, position: 1 },
            { answer_text: 'Option 3', is_correct: false, position: 2 },
            { answer_text: 'Option 4', is_correct: false, position: 3 }
          ];
        }
        
        // Make sure at least one answer is marked as correct
        if (!updatedAnswers.some(a => a.is_correct) && updatedAnswers.length > 0) {
          updatedAnswers[0].is_correct = true;
        }
        
        return {
          ...prev,
          // Keep question text and explanation
          question_text: prev.question_text,
          explanation: prev.explanation,
          // Set correct_answer from previous state
          correct_answer: correctAnswer,
          answers: updatedAnswers
        };
      });
    } else if (questionData.question_type === 'open_ended') {
      // For open-ended, preserve any existing answer data
      setQuestionData(prev => {
        // If we had a correct answer in boolean/multiple choice, use it
        const correctAnswer = prev.correct_answer || 
          prev.answers.find(a => a.is_correct)?.answer_text || 
          prev.explanation || '';
        
        return {
          ...prev,
          // Keep question text and explanation
          question_text: prev.question_text,
          explanation: prev.explanation,
          answers: [],
          correct_answer: correctAnswer
        };
      });
    }
  }, [questionData.question_type]);

  return (
    <div className="bg-white border-2 border-primary-200 rounded-lg p-4 shadow-lg">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Question Type
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setQuestionData(prev => ({ ...prev, question_type: 'multiple_choice' }))}
              className={`px-3 py-1 text-sm rounded-md ${
                questionData.question_type === 'multiple_choice'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Multiple Choice
            </button>
            <button
              type="button"
              onClick={() => setQuestionData(prev => ({ ...prev, question_type: 'boolean' }))}
              className={`px-3 py-1 text-sm rounded-md ${
                questionData.question_type === 'boolean'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              True/False
            </button>
            <button
              type="button"
              onClick={() => setQuestionData(prev => ({ ...prev, question_type: 'open_ended' }))}
              className={`px-3 py-1 text-sm rounded-md ${
                questionData.question_type === 'open_ended'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Open-Ended
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Question Text
          </label>
          <textarea
            name="question_text"
            value={questionData.question_text}
            onChange={handleQuestionChange}
            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
            rows="3"
            placeholder="Enter your question here"
          />
        </div>

        {/* Show Answer Options for multiple choice and boolean questions */}
        {(questionData.question_type === 'multiple_choice' || questionData.question_type === 'boolean') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Answer Options
            </label>
            <div className="space-y-2">
              {questionData.answers.map((answer, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="radio"
                    checked={answer.is_correct}
                    onChange={() => handleCorrectAnswerSelect(index)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                  />
                  <input
                    type="text"
                    value={answer.answer_text}
                    onChange={(e) => handleAnswerChange(index, 'answer_text', e.target.value)}
                    className="flex-grow p-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    placeholder={`Answer option ${index + 1}`}
                    disabled={questionData.question_type === 'boolean'}
                  />
                  {questionData.question_type === 'multiple_choice' && questionData.answers.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeAnswerOption(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {questionData.question_type === 'multiple_choice' && questionData.answers.length < 6 && (
              <button
                type="button"
                onClick={addAnswerOption}
                className="mt-2 text-primary-600 hover:text-primary-800 text-sm flex items-center"
              >
                <PlusCircleIcon className="h-4 w-4 mr-1" />
                Add Option
              </button>
            )}
          </div>
        )}
        
        {/* Show Correct Answer input for open-ended questions */}
        {questionData.question_type === 'open_ended' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Correct Answer
            </label>
            <textarea
              name="correct_answer"
              value={questionData.correct_answer}
              onChange={handleCorrectAnswerChange}
              className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
              rows="3"
              placeholder="Enter the expected correct answer"
            />
          </div>
        )}
        

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Explanation (Optional)
          </label>
          <textarea
            name="explanation"
            value={questionData.explanation}
            onChange={handleQuestionChange}
            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
            rows="2"
            placeholder="Explain why the correct answer is right"
          />
        </div>

        <div className="flex justify-end space-x-3 pt-3">
          <Button
            onClick={onCancel}
            variant="outline"
            size="sm"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            variant="primary"
            size="sm"
          >
            {isNew ? 'Add Question' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default QuestionEditor;