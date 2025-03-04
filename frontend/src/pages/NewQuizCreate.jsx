import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { toast } from 'react-hot-toast';
import useAppStore from '../store/appStore';
import QuizBuilder from '../components/quiz/QuizBuilder';
import { getDocuments } from '../services/api';

const NewQuizCreate = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [documents, setDocuments] = useState([]);
  const [selectedDocuments, setSelectedDocuments] = useState([]);
  const { 
    error, 
    clearError
  } = useAppStore();

  // Fetch all documents when component mounts
  useEffect(() => {
    async function fetchAllDocuments() {
      try {
        const fetchedDocuments = await getDocuments();
        setDocuments(fetchedDocuments);

        // Check if documents were pre-selected from navigation state
        const preSelectedDocs = location.state?.selectedDocumentIds || [];
        setSelectedDocuments(preSelectedDocs);
      } catch (error) {
        console.error('Failed to fetch documents:', error);
        toast.error('Failed to load documents');
      }
    }

    fetchAllDocuments();
  }, [location.state]);

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
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto py-6">
        <QuizBuilder 
          initialSelectedDocuments={location.state?.selectedDocumentIds || []} 
        />
      </div>
    </div>
  );
};

export default NewQuizCreate;