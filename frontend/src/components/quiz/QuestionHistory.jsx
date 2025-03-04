// frontend/src/components/quiz/QuestionHistory.jsx
import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { getQuestionHistory, revertQuestion } from '../../services/api';
import Button from '../common/Button';
import {
  ClockIcon,
  ArrowUturnLeftIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

const QuestionHistory = ({ quizId, questionId, onRevert, onClose }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reverting, setReverting] = useState(false);
  
  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const historyData = await getQuestionHistory(quizId, questionId);
        setHistory(historyData);
      } catch (error) {
        toast.error('Failed to load question history');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [quizId, questionId]);

  const handleRevert = async (historyId) => {
    if (!confirm('Are you sure you want to revert to this version?')) return;

    setReverting(true);
    try {
      const revertedQuestion = await revertQuestion(quizId, questionId, historyId);
      toast.success('Question reverted to previous version');
      
      // Call the parent component's onRevert callback
      if (onRevert) {
        onRevert(revertedQuestion);
      }
      
      onClose();
    } catch (error) {
      toast.error('Failed to revert question');
      console.error(error);
    } finally {
      setReverting(false);
    }
  };

  // Helper function to format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Helper function to get action description
  const getActionDescription = (action) => {
    switch (action) {
      case 'create': return 'Created';
      case 'update': return 'Updated';
      case 'regenerate': return 'Regenerated';
      case 'revert': return 'Reverted';
      default: return action;
    }
  };

  // Helper to get color for action type
  const getActionColor = (action) => {
    switch (action) {
      case 'create': return 'bg-green-100 text-green-800';
      case 'update': return 'bg-blue-100 text-blue-800';
      case 'regenerate': return 'bg-purple-100 text-purple-800';
      case 'revert': return 'bg-amber-100 text-amber-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 max-h-[80vh] overflow-y-auto">
      <div className="flex justify-between items-center border-b pb-3 mb-4">
        <h3 className="text-lg font-semibold flex items-center">
          <ClockIcon className="h-5 w-5 mr-2 text-gray-600" />
          Question Version History
        </h3>
        <button 
          className="text-gray-500 hover:text-gray-700"
          onClick={onClose}
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-6 text-gray-500">
          No history available for this question.
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((item) => (
            <div key={item.id} className="border rounded-md p-3 bg-gray-50">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${getActionColor(item.action)}`}>
                    {getActionDescription(item.action)}
                  </span>
                  <span className="text-sm text-gray-600 ml-2">
                    {formatDate(item.timestamp)}
                  </span>
                </div>
                <Button
                  onClick={() => handleRevert(item.id)}
                  variant="outline"
                  size="sm"
                  disabled={reverting}
                  className="flex items-center"
                >
                  <ArrowUturnLeftIcon className="h-3 w-3 mr-1" />
                  Revert to this version
                </Button>
              </div>
              
              {item.previous_state && (
                <div className="mt-2 border-t pt-2">
                  <div className="text-sm text-gray-700">
                    <div><strong>Question: </strong> {item.previous_state.question_text}</div>
                    {item.previous_state.explanation && (
                      <div className="mt-1"><strong>Explanation: </strong> {item.previous_state.explanation}</div>
                    )}
                    {item.previous_state.answers && item.previous_state.answers.length > 0 && (
                      <div className="mt-1">
                        <strong>Answers:</strong>
                        <ul className="ml-2 mt-1 space-y-1">
                          {item.previous_state.answers.map((answer, index) => (
                            <li key={index} className={answer.is_correct ? 'text-green-600' : ''}>
                              {answer.is_correct && '✓ '}{answer.answer_text}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default QuestionHistory;