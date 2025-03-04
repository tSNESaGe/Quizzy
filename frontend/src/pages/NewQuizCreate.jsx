// frontend/src/pages/NewQuizCreate.jsx
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { toast } from 'react-hot-toast';
import useAppStore from '../store/appStore';
import QuizBuilder from '../components/quiz/QuizBuilder';

const NewQuizCreate = () => {
  const navigate = useNavigate();
  const { 
    error, 
    clearError, 
    isAuthenticated 
  } = useAppStore();

  // Ensure user is authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      toast.error('Please log in to create a quiz');
      navigate('/login', { state: { from: '/quizzes/new' } });
    }
  }, [isAuthenticated, navigate]);

  // Clear any errors when component mounts and unmounts
  useEffect(() => {
    clearError();
    return () => clearError();
  }, [clearError]);

  // Display any errors that occur
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  return (
    <>
      <Helmet>
        <title>Create New Quiz | AI Quiz Generator</title>
        <meta name="description" content="Create a new AI-generated quiz based on your documents or any topic" />
      </Helmet>
      
      <div className="bg-gray-50 min-h-screen">
        <div className="container mx-auto py-6">
          <QuizBuilder />
        </div>
      </div>
    </>
  );
};

export default NewQuizCreate;