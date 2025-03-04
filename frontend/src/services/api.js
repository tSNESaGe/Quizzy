// frontend/src/services/api.js
import axios from 'axios';
import { toast } from 'react-hot-toast';

// Create axios instance with base URL
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
});

// Add request interceptor to include auth token in all requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // Handle common errors with toast notifications
    if (error.response) {
      if (error.response.status === 401) {
        // Unauthorized - clear token and redirect to login
        localStorage.removeItem('token');
        window.location.href = '/login';
        toast.error('Your session has expired. Please login again.');
      } else if (error.response.status === 422) {
        // Validation error
        const detail = error.response.data.detail;
        if (Array.isArray(detail)) {
          // Multiple validation errors
          detail.forEach(err => {
            toast.error(`${err.loc.join('.')}: ${err.msg}`);
          });
        } else {
          toast.error(detail || 'Validation error');
        }
      } else if (error.response.status >= 500) {
        // Server error
        toast.error('Server error. Please try again later.');
      } else {
        // Other errors
        toast.error(error.response.data.detail || 'An error occurred');
      }
    } else if (error.request) {
      // Network error
      toast.error('Network error. Please check your connection.');
    } else {
      toast.error('An unexpected error occurred');
    }
    
    return Promise.reject(error);
  }
);

// Auth API
export const login = async (username, password) => {
  const formData = new FormData();
  formData.append('username', username);
  formData.append('password', password);
  return api.post('/auth/token', formData);
};

export const register = async (userData) => {
  return api.post('/auth/register', userData);
};

export const getCurrentUser = async () => {
  return api.get('/auth/me');
};

export const updateUserSettings = async (userData) => {
  return api.put('/auth/me', userData);
};

// Document API
export const getDocuments = async () => {
  return api.get('/documents');
};

export const getDocumentById = async (id) => {
  return api.get(`/documents/${id}`);
};

export const uploadDocument = async (file, createEmbeddings = true, skipDuplicates = true) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('create_embeddings', createEmbeddings);
  formData.append('skip_duplicates', skipDuplicates);
  return api.post('/documents/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    }
  });
};

export const batchUploadDocuments = async (files, createEmbeddings = true, skipDuplicates = true) => {
  const formData = new FormData();
  files.forEach(file => {
    formData.append('files', file);
  });
  formData.append('create_embeddings', createEmbeddings);
  formData.append('skip_duplicates', skipDuplicates);
  return api.post('/documents/batch-upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    }
  });
};

export const deleteDocument = async (id) => {
  return api.delete(`/documents/${id}`);
};

export const createDocumentEmbeddings = async (id) => {
  return api.post(`/documents/${id}/embeddings`);
};

export const deleteDocumentEmbeddings = async (id) => {
  return api.delete(`/documents/${id}/embeddings`);
};

export const searchDocuments = async (query, documentIds = null, topK = 5) => {
  let url = `/documents/search?query=${encodeURIComponent(query)}&top_k=${topK}`;
  
  if (documentIds && documentIds.length > 0) {
    // Add document_ids as query parameters
    documentIds.forEach(id => {
      url += `&document_ids=${id}`;
    });
  }
  
  return api.get(url);
};

// Quiz API
export const getQuizzes = async () => {
  return api.get('/quizzes');
};

export const getQuizById = async (id) => {
  return api.get(`/quizzes/${id}`);
};

export const generateQuiz = async (quizData) => {
  return api.post('/quizzes/generate', quizData);
};

export const updateQuiz = async (id, quizData) => {
  return api.put(`/quizzes/${id}`, quizData);
};

export const deleteQuiz = async (id) => {
  return api.delete(`/quizzes/${id}`);
};

export const regenerateQuiz = async (id, useEmbeddings = true) => {
  return api.post(`/quizzes/${id}/regenerate?use_embeddings=${useEmbeddings}`);
};

export const addQuestion = async (quizId, questionData) => {
  // Make sure the question data is properly formatted for the backend
  const formattedData = {
    question_text: questionData.question_text,
    question_type: questionData.question_type,
    explanation: questionData.explanation || '',
    position: questionData.position || 0,  // Default to 0 if no position specified
    answers: questionData.answers.map((answer, index) => ({
      answer_text: answer.answer_text,
      is_correct: answer.is_correct,
      position: answer.position || index
    }))
  };
  
  return api.post(`/quizzes/${quizId}/questions`, formattedData);
};

export const updateQuestionPositions = async (quizId, questions) => {
  // Format questions into the correct structure for API
  const questionsPayload = questions.map(question => ({
    id: question.id,
    position: question.position
  }));
  
  return api.put(`/quizzes/${quizId}/questions/reorder`, questionsPayload);
};

export const updateQuestion = async (quizId, questionId, questionData) => {
  // Ensure only valid fields are sent
  const validFields = {
    question_text: questionData.question_text,
    question_type: questionData.question_type,
    explanation: questionData.explanation,
    answers: questionData.answers,
    open_ended_guidelines: questionData.open_ended_guidelines
  };

  // Filter out undefined or null values
  const filteredData = Object.fromEntries(
    Object.entries(validFields).filter(([_, v]) => v !== undefined && v !== null)
  );

  return api.put(`/quizzes/${quizId}/questions/${questionId}`, filteredData);
};

export const deleteQuestion = async (quizId, questionId) => {
  return api.delete(`/quizzes/${quizId}/questions/${questionId}`);
};

export const regenerateQuestion = async (quizId, questionId, useDocumentContent = true) => {
  return api.post(`/quizzes/${quizId}/questions/${questionId}/regenerate?use_document_content=${useDocumentContent}`);
};

export const convertQuestionType = async (quizId, questionId, newType) => {
  return api.post(`/quizzes/${quizId}/questions/${questionId}/change-type`, {
    question_type: newType
  });
};

export const changeQuestionType = async (quizId, questionId, newType, useDocumentContent = true) => {
  try {
    const response = await api.post(
      `/quizzes/${quizId}/questions/${questionId}/change-type`, 
      { question_type: newType },
      { params: { use_document_content: useDocumentContent } }
    );
    return response;
  } catch (error) {
    // Handle error specifically for question type conversion
    console.error('Error changing question type:', error);
    throw error;
  }
};

export const getQuestionHistory = async (quizId, questionId, limit = 20) => {
  return api.get(`/quizzes/${quizId}/questions/${questionId}/history?limit=${limit}`);
};

export const getQuizHistory = async (quizId, limit = 50) => {
  return api.get(`/quizzes/${quizId}/history?limit=${limit}`);
};

export const revertQuestion = async (quizId, questionId, historyId = null) => {
  let url = `/quizzes/${quizId}/questions/${questionId}/revert`;
  if (historyId) {
    url += `?history_id=${historyId}`;
  }
  return api.post(url);
};

export const revertQuiz = async (quizId, historyId = null) => {
  let url = `/quizzes/${quizId}/revert`;
  if (historyId) {
    url += `?history_id=${historyId}`;
  }
  return api.post(url);
};

// Project API
export const getProjects = async () => {
  return api.get('/projects');
};

export const getProjectById = async (id) => {
  return api.get(`/projects/${id}`);
};

export const createProject = async (projectData) => {
  return api.post('/projects', projectData);
};

export const updateProject = async (id, projectData) => {
  return api.put(`/projects/${id}`, projectData);
};

export const deleteProject = async (id) => {
  return api.delete(`/projects/${id}`);
};

export const addQuizToProject = async (projectId, quizId, position) => {
  return api.post(`/projects/${projectId}/quizzes`, {
    quiz_id: quizId,
    position: position
  });
};

export const removeQuizFromProject = async (projectId, quizId) => {
  return api.delete(`/projects/${projectId}/quizzes/${quizId}`);
};

export const reorderProjectQuizzes = async (projectId, quizOrders) => {
  return api.put(`/projects/${projectId}/quizzes/reorder`, quizOrders);
};

export const getProjectHistory = async (projectId, limit = 50) => {
  return api.get(`/projects/${projectId}/history?limit=${limit}`);
};

export const revertProject = async (projectId, historyId = null) => {
  let url = `/projects/${projectId}/revert`;
  if (historyId) {
    url += `?history_id=${historyId}`;
  }
  return api.post(url);
};

// History API
export const getUserHistory = async (options = {}) => {
  let url = '/history/user';
  const params = new URLSearchParams();
  
  if (options.limit) params.append('limit', options.limit);
  if (options.actionTypes) {
    options.actionTypes.forEach(type => {
      params.append('action_types', type);
    });
  }
  if (options.entityTypes) {
    options.entityTypes.forEach(type => {
      params.append('entity_types', type);
    });
  }
  if (options.dateFrom) params.append('date_from', options.dateFrom);
  if (options.dateTo) params.append('date_to', options.dateTo);
  
  const queryString = params.toString();
  if (queryString) {
    url += `?${queryString}`;
  }
  
  return api.get(url);
};

export const getHistorySummary = async (options = {}) => {
  let url = '/history/summary';
  const params = new URLSearchParams();
  
  if (options.limit) params.append('limit', options.limit);
  if (options.actionTypes) {
    options.actionTypes.forEach(type => {
      params.append('action_types', type);
    });
  }
  if (options.entityTypes) {
    options.entityTypes.forEach(type => {
      params.append('entity_types', type);
    });
  }
  if (options.dateFrom) params.append('date_from', options.dateFrom);
  if (options.dateTo) params.append('date_to', options.dateTo);
  
  const queryString = params.toString();
  if (queryString) {
    url += `?${queryString}`;
  }
  
  return api.get(url);
};

export default api;