// frontend/src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import { HelmetProvider } from 'react-helmet-async';

// Layout
import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import QuizList from './pages/QuizList';
import QuizEdit from './pages/QuizEdit';
import QuizPreview from './pages/QuizPreview';
import ProjectList from './pages/ProjectList';
import ProjectEdit from './pages/ProjectEdit';
import DocumentList from './pages/DocumentList';
import Settings from './pages/Settings';

// New Pages
import NewQuizCreate from './pages/NewQuizCreate';

// Auth components
import PrivateRoute from './components/auth/PrivateRoute';
import { AuthProvider } from './context/AuthContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Router>
            <Toaster 
              position="top-right" 
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#363636',
                  color: '#fff',
                },
                success: {
                  duration: 3000,
                  iconTheme: {
                    primary: '#10B981',
                    secondary: 'white',
                  },
                },
                error: {
                  duration: 5000,
                  iconTheme: {
                    primary: '#EF4444',
                    secondary: 'white',
                  },
                },
              }}
            />
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Protected Routes */}
              <Route
                path="/"
                element={
                  <PrivateRoute>
                    <Layout />
                  </PrivateRoute>
                }
              >
                <Route index element={<Dashboard />} />
                
                {/* Quiz Routes */}
                <Route path="quizzes">
                  <Route index element={<QuizList />} />
                  <Route path="new" element={<NewQuizCreate />} />
                  <Route path=":id" element={<QuizEdit />} />
                  <Route path=":id/preview" element={<QuizPreview />} />
                </Route>
                
                {/* Project Routes */}
                <Route path="projects">
                  <Route index element={<ProjectList />} />
                  <Route path="new" element={<ProjectEdit />} />
                  <Route path=":id" element={<ProjectEdit />} />
                </Route>
                
                {/* Document Routes */}
                <Route path="documents">
                  <Route index element={<DocumentList />} />
                </Route>
                
                <Route path="settings" element={<Settings />} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
        </AuthProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;