import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useAppStore from '../store/appStore';
import { toast } from 'react-hot-toast';
import { getQuizzes } from '../services/api';

const QuizList = () => {
  const { quizzes, setQuizzes } = useAppStore();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchQuizzes() {
      setLoading(true);
      try {
        const response = await getQuizzes();
        setQuizzes(response);
      } catch (error) {
        toast.error('Failed to load quizzes');
      } finally {
        setLoading(false);
      }
    }
    fetchQuizzes();
  }, [setQuizzes]);

  if (loading) return <div>Loading quizzes...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Quiz List</h1>
      {quizzes.length === 0 ? (
        <p>No quizzes available.</p>
      ) : (
        <ul>
          {quizzes.map((quiz) => (
            <li key={quiz.id} className="mb-2">
              <Link className="text-primary-600" to={`/quizzes/${quiz.id}`}>
                {quiz.title} - {quiz.topic}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default QuizList;