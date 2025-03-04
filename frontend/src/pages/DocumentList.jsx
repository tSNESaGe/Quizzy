import React, { useEffect, useState } from 'react';
import { getDocuments } from '../services/api';
import { toast } from 'react-hot-toast';
import useAppStore from '../store/appStore';
import { Link } from 'react-router-dom';
import { DocumentTextIcon, TrashIcon } from '@heroicons/react/24/outline';

const DocumentList = () => {
  const { documents, setDocuments, deleteDocument, addHistory } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchDocuments() {
      setLoading(true);
      setError(null);
      try {
        const fetchedDocuments = await getDocuments();
        
        // Set documents in app store
        setDocuments(fetchedDocuments);
        
        // Add history entry for document list view
        addHistory({
          type: 'document',
          action: 'list',
          details: {
            documentCount: fetchedDocuments.length
          }
        });
      } catch (error) {
        console.error('Documents fetch error:', error);
        setError('Failed to load documents');
        toast.error('Failed to load documents');
      } finally {
        setLoading(false);
      }
    }
    
    fetchDocuments();
  }, [setDocuments, addHistory]);

  const handleDeleteDocument = async (docId) => {
    try {
      // TODO: Implement delete document API call
      deleteDocument(docId);
      
      // Add history entry for document deletion
      addHistory({
        type: 'document',
        action: 'delete',
        id: docId
      });
      
      toast.success('Document deleted');
    } catch (error) {
      console.error('Document delete error:', error);
      toast.error('Failed to delete document');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Documents</h1>
        <Link 
          to="/documents/upload" 
          className="bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700"
        >
          Upload New Document
        </Link>
      </div>

      {documents.length === 0 ? (
        <div className="text-center text-gray-500">
          <p>No documents available.</p>
          <Link 
            to="/documents/upload" 
            className="mt-4 inline-block bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700"
          >
            Upload Your First Document
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {documents.map((doc) => (
            <li 
              key={doc.id} 
              className="bg-white shadow rounded-lg p-4 hover:shadow-md transition-shadow flex items-center justify-between"
            >
              <Link 
                to={`/documents/${doc.id}`} 
                className="flex items-center flex-grow"
              >
                <DocumentTextIcon className="h-6 w-6 text-primary-600 mr-3" />
                <div>
                  <h2 className="text-lg font-semibold text-primary-600">
                    {doc.filename}
                  </h2>
                  <p className="text-gray-500 text-sm">
                    {doc.file_type.toUpperCase()} | {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                </div>
              </Link>
              <button
                onClick={() => handleDeleteDocument(doc.id)}
                className="text-gray-400 hover:text-red-500 transition-colors"
                title="Delete Document"
              >
                <TrashIcon className="h-5 w-5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default DocumentList;