// frontend/src/store/appStore.js
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import * as api from '../services/api';

// Create the store with devtools middleware for debugging and persist for local storage
const useAppStore = create(
  devtools(
    persist(
      (set, get) => ({
        // Auth state
        user: null,
        isAuthenticated: false,
        
        // UI state
        isLoading: false,
        isGenerating: false,
        activeView: 'grid', // 'grid' or 'list'
        sidebarOpen: false,
        error: null,
        
        // Data state
        documents: [],
        currentDocument: null,
        documentEmbeddings: {},
        
        quizzes: [],
        currentQuiz: null,
        quizHistory: [],
        
        projects: [],
        currentProject: null,
        
        // History and activity tracking
        userHistory: [],
        userActivity: [],
        
        // Toggle sidebar
        toggleSidebar: () => set(state => ({ sidebarOpen: !state.sidebarOpen })),
        
        // Toggle view mode
        setActiveView: (viewMode) => set({ activeView: viewMode }),
        
        // Auth actions
        login: async (username, password) => {
          set({ isLoading: true, error: null });
          try {
            const response = await api.login(username, password);
            
            // Get user data
            const userData = await api.getCurrentUser();
            
            set({ 
              user: userData, 
              isAuthenticated: true, 
              isLoading: false 
            });
            return true;
          } catch (error) {
            set({ 
              error: error.response?.data?.detail || 'Login failed', 
              isLoading: false 
            });
            return false;
          }
        },
        
        register: async (userData) => {
          set({ isLoading: true, error: null });
          try {
            await api.register(userData);
            set({ isLoading: false });
            return true;
          } catch (error) {
            set({ 
              error: error.response?.data?.detail || 'Registration failed', 
              isLoading: false 
            });
            return false;
          }
        },
        
        logout: () => {
          localStorage.removeItem('token');
          set({ 
            user: null, 
            isAuthenticated: false,
            currentDocument: null,
            currentQuiz: null,
            currentProject: null
          });
        },
        
        updateUser: async (userData) => {
          set({ isLoading: true, error: null });
          try {
            const updatedUser = await api.updateUserSettings(userData);
            set({ 
              user: updatedUser, 
              isLoading: false 
            });
            return true;
          } catch (error) {
            set({ 
              error: error.response?.data?.detail || 'Update failed', 
              isLoading: false 
            });
            return false;
          }
        },
        
        // Document actions
        fetchDocuments: async () => {
          set({ isLoading: true, error: null });
          try {
            const documents = await api.getDocuments();
            set({ documents, isLoading: false });
            return documents;
          } catch (error) {
            set({ 
              error: error.response?.data?.detail || 'Failed to fetch documents', 
              isLoading: false 
            });
            return [];
          }
        },
        
        uploadDocument: async (file, createEmbeddings = true) => {
          set({ isLoading: true, error: null });
          try {
            const document = await api.uploadDocument(file, createEmbeddings);
            
            set(state => ({ 
              documents: [...state.documents, document], 
              isLoading: false 
            }));
            
            return document;
          } catch (error) {
            set({ 
              error: error.response?.data?.detail || 'Upload failed', 
              isLoading: false 
            });
            return null;
          }
        },
        
        fetchDocument: async (id) => {
          set({ isLoading: true, error: null });
          try {
            const document = await api.getDocumentById(id);
            set({ currentDocument: document, isLoading: false });
            return document;
          } catch (error) {
            set({ 
              error: error.response?.data?.detail || 'Failed to fetch document', 
              isLoading: false 
            });
            return null;
          }
        },
        
        deleteDocument: async (id) => {
          set({ isLoading: true, error: null });
          try {
            await api.deleteDocument(id);
            
            set(state => ({ 
              documents: state.documents.filter(doc => doc.id !== id),
              currentDocument: state.currentDocument?.id === id ? null : state.currentDocument,
              isLoading: false 
            }));
            
            return true;
          } catch (error) {
            set({ 
              error: error.response?.data?.detail || 'Delete failed', 
              isLoading: false 
            });
            return false;
          }
        },
        
        updateQuizQuestionPositions: async (quizId, positionsPayload) => {
          // Store current quiz state for potential rollback
          const currentQuizBackup = get().currentQuiz; 
          
          try {
            // The UI should already be updated at this point since we're using optimistic updates
            // Make the API call without waiting for it
            const response = await api.updateQuestionPositions(quizId, positionsPayload);
            
            // After successful API call, sync with server response if needed
            if (response) {
              // If the server returned updated quiz data, use it to ensure consistency
              set(state => ({
                quizzes: state.quizzes.map(q => 
                  q.id === quizId && response.questions ? 
                    { ...q, questions: response.questions } : q
                ),
              }));
            }
            
            return true;
          } catch (error) {
            // If the API call fails, revert to the backup
            console.error('Error updating question positions:', error);
            
            set(state => ({
              currentQuiz: state.currentQuiz?.id === quizId ? currentQuizBackup : state.currentQuiz,
              error: error.response?.data?.detail || 'Failed to update question positions',
            }));
            
            // Try to refresh quiz data from server
            try {
              const refreshedQuiz = await api.getQuizById(quizId);
              set(state => ({
                currentQuiz: state.currentQuiz?.id === quizId ? refreshedQuiz : state.currentQuiz,
              }));
            } catch (refreshError) {
              console.error('Failed to refresh quiz after reordering error:', refreshError);
            }
            
            return false;
          }
        },

        createDocumentEmbeddings: async (id) => {
          set({ isLoading: true, error: null });
          try {
            await api.createDocumentEmbeddings(id);
            
            // Update document's embedding status if it exists in the list
            set(state => {
              const updatedDocuments = state.documents.map(doc => 
                doc.id === id ? { ...doc, embeddings_created: true } : doc
              );
              
              return { 
                documents: updatedDocuments,
                documentEmbeddings: {
                  ...state.documentEmbeddings,
                  [id]: true
                },
                isLoading: false 
              };
            });
            
            return true;
          } catch (error) {
            set({ 
              error: error.response?.data?.detail || 'Failed to create embeddings', 
              isLoading: false 
            });
            return false;
          }
        },
        
        searchDocuments: async (query, documentIds = null, topK = 5) => {
          set({ isLoading: true, error: null });
          try {
            const results = await api.searchDocuments(query, documentIds, topK);
            set({ isLoading: false });
            return results;
          } catch (error) {
            set({ 
              error: error.response?.data?.detail || 'Search failed', 
              isLoading: false 
            });
            return [];
          }
        },
        
        setDocuments: (documents) => set({ documents }),
        
        // Quiz actions
        fetchQuizzes: async () => {
          set({ isLoading: true, error: null });
          try {
            const quizzes = await api.getQuizzes();
            set({ quizzes, isLoading: false });
            return quizzes;
          } catch (error) {
            set({ 
              error: error.response?.data?.detail || 'Failed to fetch quizzes', 
              isLoading: false 
            });
            return [];
          }
        },
        
        fetchQuiz: async (id) => {
          set({ isLoading: true, error: null });
          try {
            const quiz = await api.getQuizById(id);
            set({ currentQuiz: quiz, isLoading: false });
            return quiz;
          } catch (error) {
            set({ 
              error: error.response?.data?.detail || 'Failed to fetch quiz', 
              isLoading: false 
            });
            return null;
          }
        },
        
        generateQuiz: async (quizData) => {
          set({ isGenerating: true, error: null });
          try {
            const quiz = await api.generateQuiz(quizData);
            
            set(state => ({ 
              quizzes: [...state.quizzes, quiz], 
              currentQuiz: quiz,
              isGenerating: false 
            }));
            
            return quiz;
          } catch (error) {
            set({ 
              error: error.response?.data?.detail || 'Generation failed', 
              isGenerating: false 
            });
            return null;
          }
        },
        
        updateQuiz: async (id, quizData) => {
          set({ isLoading: true, error: null });
          try {
            const updatedQuiz = await api.updateQuiz(id, quizData);
            
            set(state => ({ 
              quizzes: state.quizzes.map(q => q.id === id ? updatedQuiz : q),
              currentQuiz: state.currentQuiz?.id === id ? updatedQuiz : state.currentQuiz,
              isLoading: false 
            }));
            
            return updatedQuiz;
          } catch (error) {
            set({ 
              error: error.response?.data?.detail || 'Update failed', 
              isLoading: false 
            });
            return null;
          }
        },
        
        deleteQuiz: async (id) => {
          set({ isLoading: true, error: null });
          try {
            await api.deleteQuiz(id);
            
            set(state => ({ 
              quizzes: state.quizzes.filter(q => q.id !== id),
              currentQuiz: state.currentQuiz?.id === id ? null : state.currentQuiz,
              isLoading: false 
            }));
            
            return true;
          } catch (error) {
            set({ 
              error: error.response?.data?.detail || 'Delete failed', 
              isLoading: false 
            });
            return false;
          }
        },
        
        regenerateQuiz: async (id, useEmbeddings = true) => {
          set({ isGenerating: true, error: null });
          try {
            const regeneratedQuiz = await api.regenerateQuiz(id, useEmbeddings);
            
            set(state => ({ 
              quizzes: state.quizzes.map(q => q.id === id ? regeneratedQuiz : q),
              currentQuiz: state.currentQuiz?.id === id ? regeneratedQuiz : state.currentQuiz,
              isGenerating: false 
            }));
            
            return regeneratedQuiz;
          } catch (error) {
            set({ 
              error: error.response?.data?.detail || 'Regeneration failed', 
              isGenerating: false 
            });
            return null;
          }
        },
        
        addQuestion: async (quizId, questionData) => {
          // Create a temporary ID for optimistic update
          const tempId = `temp-${Date.now()}`;
          
          // Create a complete question object for optimistic update
          const optimisticQuestion = {
            id: tempId,
            quiz_id: quizId,
            question_text: questionData.question_text,
            question_type: questionData.question_type,
            explanation: questionData.explanation || '',
            position: questionData.position || 0,
            correct_answer: questionData.correct_answer || '',
            answers: questionData.answers 
              ? questionData.answers.map((answer, index) => ({
                  id: `temp-answer-${index}-${Date.now()}`,
                  answer_text: answer.answer_text,
                  is_correct: answer.is_correct,
                  position: answer.position || index
                }))
              : [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          // Update UI immediately (optimistic update)
          set(state => {
            if (state.currentQuiz?.id === quizId) {
              return {
                currentQuiz: {
                  ...state.currentQuiz,
                  questions: [...state.currentQuiz.questions, optimisticQuestion]
                }
              };
            }
            return {};
          });
          
          // Now call the API to persist the change
          try {
            const actualQuestion = await api.addQuestion(quizId, questionData);
            
            // Replace the temporary question with the actual one from the server
            set(state => {
              if (state.currentQuiz?.id === quizId) {
                return {
                  currentQuiz: {
                    ...state.currentQuiz,
                    questions: state.currentQuiz.questions.map(q => 
                      q.id === tempId ? actualQuestion : q
                    )
                  },
                  isLoading: false
                };
              }
              return { isLoading: false };
            });
            
            return actualQuestion;
          } catch (error) {
            // If the server request fails, remove the optimistic question
            set(state => {
              if (state.currentQuiz?.id === quizId) {
                return {
                  currentQuiz: {
                    ...state.currentQuiz,
                    questions: state.currentQuiz.questions.filter(q => q.id !== tempId)
                  },
                  error: error.response?.data?.detail || 'Failed to add question',
                  isLoading: false
                };
              }
              return { 
                error: error.response?.data?.detail || 'Failed to add question',
                isLoading: false
              };
            });
            
            throw error; // Re-throw for the component to handle
          }
        },        
        
        updateQuestion: async (quizId, questionId, questionData) => {
          // Find the existing question for comparison
          let originalQuestion = null;
          set(state => {
            if (state.currentQuiz?.id === quizId) {
              originalQuestion = state.currentQuiz.questions.find(q => q.id === questionId);
            }
            return {}; // No state change yet
          });
          
          // If we couldn't find the question, return error
          if (!originalQuestion) {
            set({ 
              error: 'Question not found', 
              isLoading: false 
            });
            return null;
          }
          
          // Create updated question for optimistic update
          const updatedQuestion = {
            ...originalQuestion,
            ...questionData,
            // Special handling for answers if provided
            answers: questionData.answers 
              ? questionData.answers.map(a => ({
                  id: a.id || `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  question_id: questionId,
                  answer_text: a.answer_text,
                  is_correct: a.is_correct,
                  position: a.position
                }))
              : originalQuestion.answers,
            updated_at: new Date().toISOString()
          };
          
          // Update UI immediately (optimistic update)
          set(state => {
            if (state.currentQuiz?.id === quizId) {
              return {
                currentQuiz: {
                  ...state.currentQuiz,
                  questions: state.currentQuiz.questions.map(q => 
                    q.id === questionId ? updatedQuestion : q
                  )
                }
              };
            }
            return {};
          });
          
          // Now call the API to persist the change
          try {
            // Prepare data for API
            const apiData = {
              question_text: questionData.question_text,
              question_type: questionData.question_type,
              explanation: questionData.explanation,
              correct_answer: questionData.correct_answer,
              answers: questionData.answers
            };
            
            // Only include fields that were actually provided
            Object.keys(apiData).forEach(key => 
              apiData[key] === undefined && delete apiData[key]
            );
            
            const serverQuestion = await api.updateQuestion(quizId, questionId, apiData);
            
            // Update state with the server response
            set(state => {
              if (state.currentQuiz?.id === quizId) {
                return {
                  currentQuiz: {
                    ...state.currentQuiz,
                    questions: state.currentQuiz.questions.map(q => 
                      q.id === questionId ? serverQuestion : q
                    )
                  },
                  isLoading: false
                };
              }
              return { isLoading: false };
            });
            
            return serverQuestion;
          } catch (error) {
            // Revert optimistic update if server request fails
            set(state => {
              if (state.currentQuiz?.id === quizId) {
                return {
                  currentQuiz: {
                    ...state.currentQuiz,
                    questions: state.currentQuiz.questions.map(q => 
                      q.id === questionId ? originalQuestion : q
                    )
                  },
                  error: error.response?.data?.detail || 'Failed to update question',
                  isLoading: false
                };
              }
              return { 
                error: error.response?.data?.detail || 'Failed to update question',
                isLoading: false 
              };
            });
            
            throw error; // Re-throw for the component to handle
          }
        },
        
        deleteQuestion: async (quizId, questionId) => {
          // Find the question to delete
          let questionToDelete = null;
          set(state => {
            if (state.currentQuiz?.id === quizId) {
              questionToDelete = state.currentQuiz.questions.find(q => q.id === questionId);
            }
            return {}; // No state change yet
          });
          
          // Remove from UI immediately (optimistic update)
          set(state => {
            if (state.currentQuiz?.id === quizId) {
              return {
                currentQuiz: {
                  ...state.currentQuiz,
                  questions: state.currentQuiz.questions.filter(q => q.id !== questionId)
                }
              };
            }
            return {};
          });
          
          // Now call API to delete on server
          try {
            await api.deleteQuestion(quizId, questionId);
            set({ isLoading: false });
            return true;
          } catch (error) {
            // Restore the deleted question if server request fails
            set(state => {
              if (state.currentQuiz?.id === quizId && questionToDelete) {
                return {
                  currentQuiz: {
                    ...state.currentQuiz,
                    questions: [...state.currentQuiz.questions, questionToDelete].sort((a, b) => a.position - b.position)
                  },
                  error: error.response?.data?.detail || 'Failed to delete question',
                  isLoading: false
                };
              }
              return { 
                error: error.response?.data?.detail || 'Failed to delete question',
                isLoading: false 
              };
            });
            
            throw error; // Re-throw for the component to handle
          }
        },        
        
        regenerateQuestion: async (quizId, questionId, useDocumentContent = true) => {
          // Find the original question
          let originalQuestion = null;
          set(state => {
            if (state.currentQuiz?.id === quizId) {
              originalQuestion = state.currentQuiz.questions.find(q => q.id === questionId);
            }
            return {}; // No state change yet
          });
          
          if (!originalQuestion) {
            set({ error: 'Question not found', isLoading: false });
            return null;
          }
          
          set({ isGenerating: true });
          
          try {
            const regeneratedQuestion = await api.regenerateQuestion(quizId, questionId, useDocumentContent);
            
            // Update the question in state
            set(state => {
              if (state.currentQuiz?.id === quizId) {
                return {
                  currentQuiz: {
                    ...state.currentQuiz,
                    questions: state.currentQuiz.questions.map(q => 
                      q.id === questionId ? regeneratedQuestion : q
                    )
                  },
                  isGenerating: false
                };
              }
              return { isGenerating: false };
            });
            
            return regeneratedQuestion;
          } catch (error) {
            set({ 
              error: error.response?.data?.detail || 'Failed to regenerate question', 
              isGenerating: false 
            });
            
            throw error; // Re-throw for the component to handle
          }
        },        
        
        changeQuestionType: async (quizId, questionId, newType, useDocumentContent = true) => {
          set({ isLoading: true, error: null });
          try {
            const convertedQuestion = await api.changeQuestionType(quizId, questionId, newType, useDocumentContent);
            
            // Update current quiz if it contains the converted question
            set(state => {
              if (state.currentQuiz?.id === quizId) {
                return {
                  currentQuiz: {
                    ...state.currentQuiz,
                    questions: state.currentQuiz.questions.map(q => 
                      q.id === questionId ? convertedQuestion : q
                    )
                  },
                  isLoading: false
                };
              }
              return { isLoading: false };
            });
            
            return convertedQuestion;
          } catch (error) {
            set({ 
              error: error.response?.data?.detail || 'Failed to change question type', 
              isLoading: false 
            });
            return null;
          }
        },
        
        convertQuestionType: async (quizId, questionId, newType) => {
          // Find the original question
          let originalQuestion = null;
          set(state => {
            if (state.currentQuiz?.id === quizId) {
              originalQuestion = state.currentQuiz.questions.find(q => q.id === questionId);
            }
            return {}; // No state change yet
          });
          
          if (!originalQuestion) {
            set({ error: 'Question not found', isLoading: false });
            return null;
          }
          
          // Create optimistic update
          let updatedAnswers = [];
          
          if (newType === 'boolean') {
            updatedAnswers = [
              { answer_text: 'True', is_correct: true, position: 0 },
              { answer_text: 'False', is_correct: false, position: 1 }
            ];
          } else if (newType === 'multiple_choice') {
            // If coming from boolean, create 4 options with first one correct
            if (originalQuestion.question_type === 'boolean') {
              updatedAnswers = [
                { answer_text: 'Option A', is_correct: true, position: 0 },
                { answer_text: 'Option B', is_correct: false, position: 1 },
                { answer_text: 'Option C', is_correct: false, position: 2 },
                { answer_text: 'Option D', is_correct: false, position: 3 }
              ];
            } else {
              // Keep existing answers or create default ones
              updatedAnswers = originalQuestion.answers.length > 0 
                ? originalQuestion.answers
                : [
                    { answer_text: 'Option A', is_correct: true, position: 0 },
                    { answer_text: 'Option B', is_correct: false, position: 1 },
                    { answer_text: 'Option C', is_correct: false, position: 2 },
                    { answer_text: 'Option D', is_correct: false, position: 3 }
                  ];
            }
          } else if (newType === 'open_ended') {
            // For open-ended, no answers needed
            updatedAnswers = [];
          }
          
          // Create updated question with new type and answers
          const updatedQuestion = {
            ...originalQuestion,
            question_type: newType,
            answers: updatedAnswers,
            // For open-ended, use explanation as correct_answer if not already set
            correct_answer: newType === 'open_ended' 
              ? originalQuestion.correct_answer || originalQuestion.explanation
              : undefined
          };
          
          // Update UI immediately (optimistic update)
          set(state => {
            if (state.currentQuiz?.id === quizId) {
              return {
                currentQuiz: {
                  ...state.currentQuiz,
                  questions: state.currentQuiz.questions.map(q => 
                    q.id === questionId ? updatedQuestion : q
                  )
                }
              };
            }
            return {};
          });
          
          // Call API to change type on server
          try {
            const serverQuestion = await api.convertQuestionType(quizId, questionId, newType);
            
            // Update with server response
            set(state => {
              if (state.currentQuiz?.id === quizId) {
                return {
                  currentQuiz: {
                    ...state.currentQuiz,
                    questions: state.currentQuiz.questions.map(q => 
                      q.id === questionId ? serverQuestion : q
                    )
                  },
                  isLoading: false
                };
              }
              return { isLoading: false };
            });
            
            return serverQuestion;
          } catch (error) {
            // Revert to original if API call fails
            set(state => {
              if (state.currentQuiz?.id === quizId) {
                return {
                  currentQuiz: {
                    ...state.currentQuiz,
                    questions: state.currentQuiz.questions.map(q => 
                      q.id === questionId ? originalQuestion : q
                    )
                  },
                  error: error.response?.data?.detail || 'Failed to change question type',
                  isLoading: false
                };
              }
              return {
                error: error.response?.data?.detail || 'Failed to change question type',
                isLoading: false
              };
            });
            
            throw error; // Re-throw for the component to handle
          }
        },
        getQuestionHistory: async (quizId, questionId, limit = 20) => {
          set({ isLoading: true });
          
          try {
            const history = await api.getQuestionHistory(quizId, questionId, limit);
            set({ isLoading: false });
            return history;
          } catch (error) {
            set({
              error: error.response?.data?.detail || 'Failed to get question history',
              isLoading: false
            });
            
            throw error; // Re-throw for the component to handle
          }
        },

        getQuizHistory: async (quizId, limit = 50) => {
          set({ isLoading: true, error: null });
          try {
            const history = await api.getQuizHistory(quizId, limit);
            set({ quizHistory: history, isLoading: false });
            return history;
          } catch (error) {
            set({ 
              error: error.response?.data?.detail || 'Failed to get quiz history', 
              isLoading: false 
            });
            return [];
          }
        },
        
        revertQuiz: async (quizId, historyId = null) => {
          set({ isLoading: true, error: null });
          try {
            const revertedQuiz = await api.revertQuiz(quizId, historyId);
            
            set(state => ({ 
              quizzes: state.quizzes.map(q => q.id === quizId ? revertedQuiz : q),
              currentQuiz: state.currentQuiz?.id === quizId ? revertedQuiz : state.currentQuiz,
              isLoading: false 
            }));
            
            return revertedQuiz;
          } catch (error) {
            set({ 
              error: error.response?.data?.detail || 'Failed to revert quiz', 
              isLoading: false 
            });
            return null;
          }
        },

        revertQuestion: async (quizId, questionId, historyId = null) => {
          // Find the original question
          let originalQuestion = null;
          set(state => {
            if (state.currentQuiz?.id === quizId) {
              originalQuestion = state.currentQuiz.questions.find(q => q.id === questionId);
            }
            return {}; // No state change yet
          });
          
          if (!originalQuestion) {
            set({ error: 'Question not found', isLoading: false });
            return null;
          }
          
          set({ isLoading: true });
          
          try {
            const revertedQuestion = await api.revertQuestion(quizId, questionId, historyId);
            
            // Update the question in state
            set(state => {
              if (state.currentQuiz?.id === quizId) {
                return {
                  currentQuiz: {
                    ...state.currentQuiz,
                    questions: state.currentQuiz.questions.map(q => 
                      q.id === questionId ? revertedQuestion : q
                    )
                  },
                  isLoading: false
                };
              }
              return { isLoading: false };
            });
            
            return revertedQuestion;
          } catch (error) {
            set({ 
              error: error.response?.data?.detail || 'Failed to revert question', 
              isLoading: false 
            });
            
            throw error; // Re-throw for the component to handle
          }
        },        
        
        setQuizzes: (quizzes) => set({ quizzes }),
        
        // Project actions
        fetchProjects: async () => {
          set({ isLoading: true, error: null });
          try {
            const projects = await api.getProjects();
            set({ projects, isLoading: false });
            return projects;
          } catch (error) {
            set({ 
              error: error.response?.data?.detail || 'Failed to fetch projects', 
              isLoading: false 
            });
            return [];
          }
        },
        
        fetchProject: async (id) => {
          set({ isLoading: true, error: null });
          try {
            const project = await api.getProjectById(id);
            set({ currentProject: project, isLoading: false });
            return project;
          } catch (error) {
            set({ 
              error: error.response?.data?.detail || 'Failed to fetch project', 
              isLoading: false 
            });
            return null;
          }
        },
        
        createProject: async (projectData) => {
          set({ isLoading: true, error: null });
          try {
            const project = await api.createProject(projectData);
            
            set(state => ({ 
              projects: [...state.projects, project], 
              currentProject: project,
              isLoading: false 
            }));
            
            return project;
          } catch (error) {
            set({ 
              error: error.response?.data?.detail || 'Failed to create project', 
              isLoading: false 
            });
            return null;
          }
        },
        
        updateProject: async (id, projectData) => {
          set({ isLoading: true, error: null });
          try {
            const updatedProject = await api.updateProject(id, projectData);
            
            set(state => ({ 
              projects: state.projects.map(p => p.id === id ? updatedProject : p),
              currentProject: state.currentProject?.id === id ? updatedProject : state.currentProject,
              isLoading: false 
            }));
            
            return updatedProject;
          } catch (error) {
            set({ 
              error: error.response?.data?.detail || 'Failed to update project', 
              isLoading: false 
            });
            return null;
          }
        },
        
        deleteProject: async (id) => {
          set({ isLoading: true, error: null });
          try {
            await api.deleteProject(id);
            
            set(state => ({ 
              projects: state.projects.filter(p => p.id !== id),
              currentProject: state.currentProject?.id === id ? null : state.currentProject,
              isLoading: false 
            }));
            
            return true;
          } catch (error) {
            set({ 
              error: error.response?.data?.detail || 'Failed to delete project', 
              isLoading: false 
            });
            return false;
          }
        },
        
        addQuizToProject: async (projectId, quizId, position) => {
          set({ isLoading: true, error: null });
          try {
            const updatedProject = await api.addQuizToProject(projectId, quizId, position);
            
            set(state => ({ 
              projects: state.projects.map(p => p.id === projectId ? updatedProject : p),
              currentProject: state.currentProject?.id === projectId ? updatedProject : state.currentProject,
              isLoading: false 
            }));
            
            return updatedProject;
          } catch (error) {
            set({ 
              error: error.response?.data?.detail || 'Failed to add quiz to project', 
              isLoading: false 
            });
            return null;
          }
        },
        
        removeQuizFromProject: async (projectId, quizId) => {
          set({ isLoading: true, error: null });
          try {
            await api.removeQuizFromProject(projectId, quizId);
            
            // Update project if it's the current one
            set(state => {
              if (state.currentProject?.id === projectId) {
                return {
                  currentProject: {
                    ...state.currentProject,
                    quizzes: state.currentProject.quizzes.filter(q => q.quiz_id !== quizId)
                  },
                  isLoading: false
                };
              }
              return { isLoading: false };
            });
            
            return true;
          } catch (error) {
            set({ 
              error: error.response?.data?.detail || 'Failed to remove quiz from project', 
              isLoading: false 
            });
            return false;
          }
        },
        
        reorderProjectQuizzes: async (projectId, quizOrders) => {
          set({ isLoading: true, error: null });
          try {
            const updatedProject = await api.reorderProjectQuizzes(projectId, quizOrders);
            
            set(state => ({ 
              projects: state.projects.map(p => p.id === projectId ? updatedProject : p),
              currentProject: state.currentProject?.id === projectId ? updatedProject : state.currentProject,
              isLoading: false 
            }));
            
            return updatedProject;
          } catch (error) {
            set({ 
              error: error.response?.data?.detail || 'Failed to reorder quizzes', 
              isLoading: false 
            });
            return null;
          }
        },
        
        getProjectHistory: async (projectId, limit = 50) => {
          set({ isLoading: true, error: null });
          try {
            const history = await api.getProjectHistory(projectId, limit);
            set({ isLoading: false });
            return history;
          } catch (error) {
            set({ 
              error: error.response?.data?.detail || 'Failed to get project history', 
              isLoading: false 
            });
            return [];
          }
        },
        
        revertProject: async (projectId, historyId = null) => {
          set({ isLoading: true, error: null });
          try {
            const revertedProject = await api.revertProject(projectId, historyId);
            
            set(state => ({ 
              projects: state.projects.map(p => p.id === projectId ? revertedProject : p),
              currentProject: state.currentProject?.id === projectId ? revertedProject : state.currentProject,
              isLoading: false 
            }));
            
            return revertedProject;
          } catch (error) {
            set({ 
              error: error.response?.data?.detail || 'Failed to revert project', 
              isLoading: false 
            });
            return null;
          }
        },
        
        setProjects: (projects) => set({ projects }),
        
        // History actions
        getUserHistory: async (options = {}) => {
          set({ isLoading: true, error: null });
          try {
            const history = await api.getUserHistory(options);
            set({ userHistory: history, isLoading: false });
            return history;
          } catch (error) {
            set({ 
              error: error.response?.data?.detail || 'Failed to get user history', 
              isLoading: false 
            });
            return null;
          }
        },
        
        getActivitySummary: async (options = {}) => {
          set({ isLoading: true, error: null });
          try {
            const summary = await api.getHistorySummary(options);
            set({ userActivity: summary, isLoading: false });
            return summary;
          } catch (error) {
            set({ 
              error: error.response?.data?.detail || 'Failed to get activity summary', 
              isLoading: false 
            });
            return [];
          }
        },
        
        // Simple setters
        setError: (error) => set({ error }),
        clearError: () => set({ error: null }),
        
        // UI state management
        setLoading: (isLoading) => set({ isLoading }),
        setGenerating: (isGenerating) => set({ isGenerating })
      }),
      {
        name: 'quiz-app-storage',
        partialize: (state) => ({
          // Only persist these parts of state to avoid problems
          user: state.user,
          isAuthenticated: state.isAuthenticated,
          activeView: state.activeView,
          quizzes: state.quizzes?.slice(0, 10), // Only store latest 10 quizzes
          documents: state.documents?.slice(0, 10), // Only store latest 10 documents
          projects: state.projects?.slice(0, 10), // Only store latest 10 projects
        })
      }
    )
  )
);

export default useAppStore