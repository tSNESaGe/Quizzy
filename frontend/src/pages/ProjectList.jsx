import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useAppStore from '../store/appStore';
import { toast } from 'react-hot-toast';
import { getProjects } from '../services/api';

const ProjectList = () => {
  const { projects, setProjects, addHistory } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchProjects() {
      setLoading(true);
      setError(null);
      try {
        const fetchedProjects = await getProjects();
        
        // Set projects in app store
        setProjects(fetchedProjects);
        
        // Add history entry for projects view
        addHistory({
          type: 'project',
          action: 'list',
          details: {
            projectCount: fetchedProjects.length
          }
        });
      } catch (error) {
        console.error('Projects fetch error:', error);
        setError('Failed to load projects');
        toast.error('Failed to load projects');
      } finally {
        setLoading(false);
      }
    }
    
    fetchProjects();
  }, [setProjects, addHistory]);

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
        <h1 className="text-2xl font-bold">My Projects</h1>
        <Link 
          to="/projects/new" 
          className="bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700"
        >
          Create New Project
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="text-center text-gray-500">
          <p>No projects available.</p>
          <Link 
            to="/projects/new" 
            className="mt-4 inline-block bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700"
          >
            Create Your First Project
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {projects.map((project) => (
            <li 
              key={project.id} 
              className="bg-white shadow rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <Link 
                to={`/projects/${project.id}`} 
                className="block text-primary-600 hover:text-primary-800"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-semibold">{project.title}</h2>
                    {project.description && (
                      <p className="text-gray-500 text-sm mt-1 line-clamp-1">
                        {project.description}
                      </p>
                    )}
                  </div>
                  <div className="text-gray-400">
                    {new Date(project.created_at).toLocaleDateString()}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ProjectList;