import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getQuizById } from '../services/api';
import { toast } from 'react-hot-toast';
import QuizPreviewComponent from '../components/quiz/QuizPreview';
import useAppStore from '../store/appStore';

const QuizPreview = () => {
  const { id } = useParams();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const { addHistory } = useAppStore();

  useEffect(() => {
    async function fetchQuiz() {
      try {
        const fetchedQuiz = await getQuizById(id);
        
        // Add history entry for quiz view
        addHistory({
          type: 'quiz',
          action: 'view',
          id: fetchedQuiz.id,
          details: {
            title: fetchedQuiz.title,
            topic: fetchedQuiz.topic
          }
        });

        setQuiz(fetchedQuiz);
      } catch (error) {
        console.error('Quiz fetch error:', error);
        toast.error('Failed to load quiz preview');
      } finally {
        setLoading(false);
      }
    }
    
    fetchQuiz();
  }, [id, addHistory]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="flex justify-center items-center h-screen text-xl text-gray-600">
        Quiz not found
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <QuizPreviewComponent quiz={quiz} />
    </div>
  );
};

export default QuizPreview;