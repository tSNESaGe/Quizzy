import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createProject, getProjectById, updateProject } from '../services/api';
import { toast } from 'react-hot-toast';
import useAppStore from '../store/appStore';
import Button from '../components/common/Button';

const ProjectEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { projects, setProjects, addHistory } = useAppStore();
  const [project, setProject] = useState({
    title: '',
    description: '',
    use_default_prompt: true,
    custom_prompt: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id) {
      async function fetchProject() {
        setLoading(true);
        try {
          const fetchedProject = await getProjectById(id);
          setProject(fetchedProject);
        } catch (error) {
          console.error('Project fetch error:', error);
          toast.error('Failed to load project');
          navigate('/projects');
        } finally {
          setLoading(false);
        }
      }
      fetchProject();
    }
  }, [id, navigate]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setProject((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let savedProject;
      if (id) {
        // Update existing project
        savedProject = await updateProject(id, project);
        
        // Update projects in app store
        setProjects(prev => 
          prev.map(p => p.id === id ? savedProject : p)
        );
        
        // Add history entry for project update
        addHistory({
          type: 'project',
          action: 'update',
          id: id,
          details: {
            title: savedProject.title,
            description: savedProject.description
          }
        });
        
        toast.success('Project updated');
      } else {
        // Create new project
        savedProject = await createProject(project);
        
        // Add to projects in app store
        setProjects(prev => [...prev, savedProject]);
        
        // Add history entry for project creation
        addHistory({
          type: 'project',
          action: 'create',
          details: {
            title: savedProject.title,
            description: savedProject.description
          }
        });
        
        toast.success('Project created');
      }
      
      // Navigate back to projects list
      navigate('/projects');
    } catch (error) {
      console.error('Project save error:', error);
      toast.error('Failed to save project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">
        {id ? 'Edit Project' : 'New Project'}
      </h1>
      <form onSubmit={handleSubmit} className="max-w-xl space-y-6">
        <div>
          <label 
            htmlFor="title" 
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Title
          </label>
          <input
            id="title"
            type="text"
            name="title"
            value={project.title}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            required
          />
        </div>
        
        <div>
          <label 
            htmlFor="description" 
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={project.description}
            onChange={handleChange}
            rows={4}
            className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        
        <div className="flex items-center">
          <input
            id="use_default_prompt"
            type="checkbox"
            name="use_default_prompt"
            checked={project.use_default_prompt}
            onChange={handleChange}
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
          />
          <label 
            htmlFor="use_default_prompt" 
            className="ml-2 block text-sm text-gray-900"
          >
            Use default prompt
          </label>
        </div>
        
        {!project.use_default_prompt && (
          <div>
            <label 
              htmlFor="custom_prompt" 
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Custom Prompt
            </label>
            <textarea
              id="custom_prompt"
              name="custom_prompt"
              value={project.custom_prompt}
              onChange={handleChange}
              rows={4}
              className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter a custom system prompt for this project"
            />
          </div>
        )}
        
        <div>
          <Button 
            type="submit"
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Saving...' : 'Save Project'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ProjectEdit;