// frontend/src/pages/DocumentDetail.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { toast } from 'react-hot-toast';
import { 
  ArrowLeftIcon,
  TrashIcon,
  ArrowPathIcon,
  DocumentMagnifyingGlassIcon,
  QuestionMarkCircleIcon,
  SparklesIcon 
} from '@heroicons/react/24/outline';

import DocumentPreview from '../components/document/DocumentPreview';
import Button from '../components/common/Button';
import { getDocumentById, createDocumentEmbeddings, deleteDocument } from '../services/api';
import useAppStore from '../store/appStore';

const DocumentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addHistory } = useAppStore();
  
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processingEmbeddings, setProcessingEmbeddings] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  
  useEffect(() => {
    async function fetchDocument() {
      try {
        setLoading(true);
        const fetchedDocument = await getDocumentById(id);
        setDocument(fetchedDocument);
        
        // Add history entry for document view
        addHistory({
          type: 'document',
          action: 'view',
          id: fetchedDocument.id,
          details: {
            filename: fetchedDocument.filename,
            fileType: fetchedDocument.file_type
          }
        });
      } catch (error) {
        console.error('Document fetch error:', error);
        toast.error('Failed to load document');
        navigate('/documents');
      } finally {
        setLoading(false);
      }
    }
    
    fetchDocument();
  }, [id, navigate, addHistory]);
  
  const handleCreateEmbeddings = async () => {
    try {
      setProcessingEmbeddings(true);
      await createDocumentEmbeddings(id);
      
      // Refresh document data to show updated embedding status
      const refreshedDocument = await getDocumentById(id);
      setDocument(refreshedDocument);
      
      toast.success('Document embeddings created successfully');
    } catch (error) {
      console.error('Error creating embeddings:', error);
      toast.error('Failed to create embeddings');
    } finally {
      setProcessingEmbeddings(false);
    }
  };
  
  const handleDeleteDocument = async () => {
    try {
      await deleteDocument(id);
      toast.success('Document deleted successfully');
      navigate('/documents');
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to delete document');
      setConfirmDelete(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }
  
  if (!document) {
    return (
      <div className="text-center py-8">
        <DocumentMagnifyingGlassIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Document not found</h2>
        <p className="text-gray-600 mb-4">
          The document you're looking for might have been deleted or doesn't exist.
        </p>
        <Button
          onClick={() => navigate('/documents')}
          variant="primary"
        >
          Back to Documents
        </Button>
      </div>
    );
  }
  
  return (
    <>
      <Helmet>
        <title>{document.filename} | AI Quiz Generator</title>
      </Helmet>
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/documents')}
              className="mr-4 p-2 text-gray-500 hover:text-gray-700 rounded-full"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">{document.filename}</h1>
          </div>
          
          <div className="flex space-x-3">
            {!document.embeddings_created && (
              <Button
                onClick={handleCreateEmbeddings}
                variant="secondary"
                disabled={processingEmbeddings}
                className="flex items-center"
              >
                {processingEmbeddings ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <SparklesIcon className="h-4 w-4 mr-2" />
                    Create Embeddings
                  </>
                )}
              </Button>
            )}
            
            <Button
              onClick={() => navigate(`/quizzes/new`, { state: { selectedDocumentId: document.id } })}
              variant="primary"
              className="flex items-center"
            >
              <QuestionMarkCircleIcon className="h-4 w-4 mr-2" />
              Generate Quiz
            </Button>
            
            <Button
              onClick={() => setConfirmDelete(true)}
              variant="danger"
              className="flex items-center"
            >
              <TrashIcon className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
        
        {/* Document preview */}
        <DocumentPreview document={document} />
        
        {/* Delete confirmation */}
        {confirmDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Delete Document?
              </h3>
              <p className="text-gray-600 mb-4">
                Are you sure you want to delete "{document.filename}"? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <Button
                  onClick={() => setConfirmDelete(false)}
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDeleteDocument}
                  variant="danger"
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default DocumentDetail;