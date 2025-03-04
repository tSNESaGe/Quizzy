// frontend/src/pages/QuizEdit.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useAppStore from '../store/appStore';
import Button from '../components/common/Button';
import QuestionEditor from '../components/quiz/QuestionEditor';
import QuizPreview from '../components/quiz/QuizPreview';

const QuizEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { 
    currentQuiz, 
    fetchQuiz, 
    updateQuiz, 
    regenerateQuiz, 
    revertQuiz,
    isLoading, 
    isGenerating, 
    error,
    clearError 
  } = useAppStore();

  const [editMode, setEditMode] = useState('edit'); // 'edit' or 'preview'
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [quizForm, setQuizForm] = useState({
    title: '',
    topic: '',
    description: '',
    use_default_prompt: true,
    custom_prompt: ''
  });

  // Fetch quiz data on component mount
  useEffect(() => {
    const loadQuiz = async () => {
      const result = await fetchQuiz(id);
      if (!result) {
        navigate('/quizzes');
      }
    };
    
    loadQuiz();
    clearError();
    
    return () => {
      clearError();
    };
  }, [id, fetchQuiz, navigate, clearError]);

  // Update form when quiz data changes
  useEffect(() => {
    if (currentQuiz) {
      setQuizForm({
        title: currentQuiz.title || '',
        topic: currentQuiz.topic || '',
        description: currentQuiz.description || '',
        use_default_prompt: currentQuiz.use_default_prompt,
        custom_prompt: currentQuiz.custom_prompt || ''
      });
    }
  }, [currentQuiz]);

  const handleEditQuestion = (question) => {
    setCurrentQuestion(question);
  };

  const handleCloseQuestionEditor = (updatedQuestion) => {
    setCurrentQuestion(null);
    
    // If question was updated, update local quiz state
    if (updatedQuestion && currentQuiz) {
      // In a real implementation, this would call an API update
      console.log('Question updated:', updatedQuestion);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setQuizForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleTogglePrompt = () => {
    setQuizForm(prev => ({
      ...prev,
      use_default_prompt: !prev.use_default_prompt
    }));
  };

  const handleSaveQuiz = async () => {
    await updateQuiz(id, quizForm);
  };

  const handleRegenerateQuiz = async () => {
    await regenerateQuiz(id);
  };

  const handleRevertQuiz = async () => {
    await revertQuiz(id);
  };

  if (isLoading && !currentQuiz) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4">
        <div className="text-center py-8">
          <p className="text-gray-500">Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (!currentQuiz) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4">
        <div className="text-center py-8">
          <p className="text-gray-500">Quiz not found</p>
          <Button
            onClick={() => navigate('/quizzes')}
            variant="primary"
            className="mt-4"
          >
            Back to Quizzes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{currentQuiz.title}</h1>
          <p className="text-gray-600">
            {currentQuiz.questions.length} questions · Created on {new Date(currentQuiz.created_at).toLocaleDateString()}
          </p>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={() => setEditMode(editMode === 'edit' ? 'preview' : 'edit')}
            variant="secondary"
          >
            {editMode === 'edit' ? 'Preview Quiz' : 'Edit Quiz'}
          </Button>
          
          <Button
            onClick={handleRegenerateQuiz}
            variant="outline"
            disabled={isGenerating}
          >
            {isGenerating ? 'Regenerating...' : 'Regenerate All Questions'}
          </Button>
          
          <Button
            onClick={handleRevertQuiz}
            variant="outline"
            disabled={isLoading}
          >
            Revert to Previous Version
          </Button>
        </div>
      </div>
      
      {error && (
        <div className="mb-6 p-4 bg-red-100 text-red-800 rounded">
          Error: {error}
        </div>
      )}
      
      {editMode === 'edit' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Quiz Settings</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quiz Title
                  </label>
                  <input
                    type="text"
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    name="title"
                    value={quizForm.title}
                    onChange={handleInputChange}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Topic
                  </label>
                  <input
                    type="text"
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    name="topic"
                    value={quizForm.topic}
                    onChange={handleInputChange}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description (optional)
                  </label>
                  <textarea
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="3"
                    name="description"
                    value={quizForm.description}
                    onChange={handleInputChange}
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                      checked={quizForm.use_default_prompt}
                      onChange={handleTogglePrompt}
                      id="use_default_prompt"
                    />
                    <label htmlFor="use_default_prompt" className="ml-2 block text-sm text-gray-700">
                      Use Default System Prompt
                    </label>
                  </div>
                  
                  {!quizForm.use_default_prompt && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Custom Prompt
                      </label>
                      <textarea
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        rows="5"
                        name="custom_prompt"
                        value={quizForm.custom_prompt}
                        onChange={handleInputChange}
                      />
                    </div>
                  )}
                </div>
                
                <div className="pt-4">
                  <Button
                    onClick={handleSaveQuiz}
                    variant="primary"
                    disabled={isLoading}
                    className="w-full"
                  >
                    {isLoading ? 'Saving...' : 'Save Quiz Settings'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
          
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b">
                <h2 className="text-xl font-semibold">Questions</h2>
              </div>
              
              <div className="divide-y">
                {currentQuiz.questions
                  .sort((a, b) => a.position - b.position)
                  .map((question, index) => (
                    <div key={question.id} className="p-6">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-medium text-gray-600 mb-1">Question {index + 1}</div>
                          <div className="text-lg">{question.question_text}</div>
                          
                          <div className="mt-3 text-gray-500 text-sm">
                            {question.question_type === 'boolean' ? 'True/False' : 'Multiple Choice'} 
                            · {question.answers.length} options
                          </div>
                          
                          <div className="mt-2">
                            {question.answers.map((answer) => (
                              <div 
                                key={answer.id} 
                                className={`text-sm py-1 ${answer.is_correct ? 'text-green-600 font-medium' : 'text-gray-600'}`}
                              >
                                {answer.is_correct && (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block mr-1" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                )}
                                {answer.answer_text}
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <Button
                          onClick={() => handleEditQuestion(question)}
                          variant="outline"
                          size="sm"
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                  ))}
                
                {currentQuiz.questions.length === 0 && (
                  <div className="p-6 text-center">
                    <p className="text-gray-500">No questions in this quiz yet.</p>
                    <Button
                      onClick={handleRegenerateQuiz}
                      variant="primary"
                      className="mt-4"
                      disabled={isGenerating}
                    >
                      Generate Questions
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <QuizPreview 
          quiz={currentQuiz} 
          onEdit={handleEditQuestion}
        />
      )}
      
      {currentQuestion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <QuestionEditor 
              quizId={id}
              question={currentQuestion}
              onClose={handleCloseQuestionEditor}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizEdit;