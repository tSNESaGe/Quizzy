import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { toast } from 'react-hot-toast';
import { 
  getDocuments, 
  deleteDocument, 
  createDocumentEmbeddings, 
  deleteDocumentEmbeddings 
} from '../services/api';
import useAppStore from '../store/appStore';
import Button from '../components/common/Button';
import FileUpload from '../components/common/FileUpload';
import DocumentPreview from '../components/document/DocumentPreview';
import { 
  DocumentTextIcon, 
  TrashIcon, 
  PlusIcon,
  DocumentMagnifyingGlassIcon,
  ArrowPathIcon,
  XMarkIcon,
  EyeIcon,
  QuestionMarkCircleIcon
} from '@heroicons/react/24/outline';

const DocumentList = () => {
  const navigate = useNavigate();
  const { documents, setDocuments, addHistory } = useAppStore();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [previewDocument, setPreviewDocument] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedDocuments, setSelectedDocuments] = useState([]);

  useEffect(() => {
    async function fetchDocuments() {
      setLoading(true);
      setError(null);
      try {
        const fetchedDocuments = await getDocuments();
        setDocuments(fetchedDocuments);
        
        addHistory({
          type: 'document',
          action: 'list',
          details: {
            documentCount: fetchedDocuments.length
          }
        });
      } catch (error) {
        console.error('Documents fetch error:', error);
        setError('Failed to load documents. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    
    fetchDocuments();
  }, [setDocuments, addHistory, refreshTrigger]);

  const handleUploadSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
    setUploadDialogOpen(false);
  };

  const handleDeleteDocument = async (docId) => {
    try {
      await deleteDocument(docId);
      
      setDocuments(prevDocs => prevDocs.filter(doc => doc.id !== docId));
      
      addHistory({
        type: 'document',
        action: 'delete',
        id: docId
      });
      
      toast.success('Document deleted');
      setConfirmDeleteId(null);
    } catch (error) {
      console.error('Document delete error:', error);
      toast.error('Failed to delete document');
    }
  };

  const handleToggleEmbeddings = async (doc) => {
    try {
      if (doc.embeddings_created) {
        await deleteDocumentEmbeddings(doc.id);
        toast.success('Embeddings removed');
      } else {
        await createDocumentEmbeddings(doc.id);
        toast.success('Embeddings created');
      }
      
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Embeddings toggle error:', error);
      toast.error('Failed to toggle embeddings');
    }
  };

  // Toggle document selection
  const toggleDocumentSelection = (docId) => {
    setSelectedDocuments(prev => 
      prev.includes(docId) 
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    );
  };

  // Generate quiz from selected documents
  const generateQuizFromDocuments = () => {
    if (selectedDocuments.length === 0) {
      toast.error('Please select at least one document');
      return;
    }

    navigate('/quizzes/new', { 
      state: { 
        selectedDocumentIds: selectedDocuments 
      } 
    });
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <>
      <Helmet>
        <title>Documents | AI Quiz Generator</title>
      </Helmet>

      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Documents</h1>
            <p className="text-gray-600">Manage your documents for quiz generation</p>
          </div>
          
          <div className="flex items-center space-x-3">
            {selectedDocuments.length > 0 && (
              <Button
                onClick={generateQuizFromDocuments}
                className="flex items-center"
              >
                <QuestionMarkCircleIcon className="h-5 w-5 mr-2" />
                Generate Quiz ({selectedDocuments.length})
              </Button>
            )}
            
            <Button
              onClick={() => setUploadDialogOpen(true)}
              className="flex items-center"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Upload Document
            </Button>
          </div>
        </div>

        {/* Error handling */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
            <div className="flex items-center">
              <XMarkIcon className="h-5 w-5 text-red-400 mr-3" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <ArrowPathIcon className="h-8 w-8 text-primary-500 animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!loading && documents.length === 0 && (
          <div className="bg-white shadow-md rounded-lg p-8 text-center">
            <DocumentMagnifyingGlassIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">No documents yet</h2>
            <p className="text-gray-600 mb-6">
              Upload documents to start generating quizzes based on their content.
            </p>
            <Button
              onClick={() => setUploadDialogOpen(true)}
              className="inline-flex items-center"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Upload Your First Document
            </Button>
          </div>
        )}

        {/* Document Table View */}
        {!loading && documents.length > 0 && (
          <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <table className="w-full table-auto">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input 
                      type="checkbox"
                      checked={selectedDocuments.length === documents.length}
                      onChange={() => 
                        setSelectedDocuments(
                          selectedDocuments.length === documents.length 
                            ? [] 
                            : documents.map(doc => doc.id)
                        )
                      }
                      className="rounded text-primary-600 focus:ring-primary-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    File Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    File Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Embeddings
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <input 
                        type="checkbox"
                        checked={selectedDocuments.includes(doc.id)}
                        onChange={() => toggleDocumentSelection(doc.id)}
                        className="rounded text-primary-600 focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-4 py-3 flex items-center">
                      <DocumentTextIcon className="h-6 w-6 text-primary-600 mr-3" />
                      <span className="font-medium text-gray-900 truncate max-w-[200px]">
                        {doc.filename}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {doc.file_type.toUpperCase()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatFileSize(doc.file_size || 0)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleEmbeddings(doc)}
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          doc.embeddings_created 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {doc.embeddings_created ? 'Remove' : 'Create'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => setPreviewDocument(doc)}
                          className="text-gray-600 hover:text-primary-600 p-1 rounded"
                          title="Preview document"
                        >
                          <EyeIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(doc.id)}
                          className="text-gray-600 hover:text-red-600 p-1 rounded"
                          title="Delete document"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Upload Dialog */}
        {uploadDialogOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-xl w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-900">
                  Upload Document
                </h3>
                <button
                  onClick={() => setUploadDialogOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              
              <FileUpload 
                onUploadSuccess={handleUploadSuccess} 
              />
            </div>
          </div>
        )}

        {/* Document Preview Modal */}
        {previewDocument && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] flex flex-col">
              <div className="flex justify-between items-center p-4 border-b">
                <h3 className="text-xl font-semibold text-gray-900">
                  Document Preview
                </h3>
                <button
                  onClick={() => setPreviewDocument(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              
              <div className="flex-grow overflow-auto p-4">
                <DocumentPreview document={previewDocument} />
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {confirmDeleteId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Delete Document?
              </h3>
              <p className="text-gray-600 mb-4">
                Are you sure you want to delete this document? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <Button
                  onClick={() => setConfirmDeleteId(null)}
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleDeleteDocument(confirmDeleteId)}
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

export default DocumentList;