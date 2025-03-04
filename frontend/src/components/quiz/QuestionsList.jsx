// frontend/src/components/quiz/QuestionsList.jsx
// Updated to ensure the question icons match the Question Bank page style

import React, { useState, useRef } from 'react';
import QuestionHistory from './QuestionHistory';
import QuestionItem from './QuestionItem';
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
  handleRemoveFromQuiz,
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
              <QuestionItem
                question={question}
                index={index}
                expandedQuestionId={expandedQuestionId}
                confirmDeleteId={confirmDeleteId}
                toggleQuestionExpand={toggleQuestionExpand}
                handleStartEditQuestion={handleStartEditQuestion}
                handleRegenerateQuestion={handleRegenerateQuestion}
                setConfirmDeleteId={setConfirmDeleteId}
                handleChangeQuestionType={handleChangeQuestionType}
                handleDeleteQuestion={handleDeleteQuestion}
                handleRemoveFromQuiz={handleRemoveFromQuiz} // Pass the handler
              />
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