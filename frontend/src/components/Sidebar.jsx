import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { 
  HomeIcon, 
  DocumentTextIcon, 
  DocumentDuplicateIcon, 
  FolderIcon,
  Cog6ToothIcon 
} from '@heroicons/react/24/outline';

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Quizzes', href: '/quizzes', icon: DocumentTextIcon },
  { name: 'Projects', href: '/projects', icon: FolderIcon },
  { name: 'Documents', href: '/documents', icon: DocumentDuplicateIcon },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
];

const Sidebar = ({ open, setOpen }) => {
  const location = useLocation();

  return (
    <>
      {/* Mobile sidebar */}
      <div
        className={`${
          open ? 'translate-x-0' : '-translate-x-full'
        } fixed top-0 left-0 z-40 w-64 h-screen transition-transform sm:translate-x-0 pt-14 bg-white border-r border-gray-200 md:sticky dark:bg-gray-800 dark:border-gray-700`}
        aria-label="Sidebar"
      >
        <div className="flex items-center justify-between mb-2 px-3 py-2 md:hidden">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-white">Menu</h3>
          <button
            onClick={() => setOpen(false)}
            className="p-1 text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
          >
            <XMarkIcon className="w-6 h-6" />
            <span className="sr-only">Close sidebar</span>
          </button>
        </div>
        
        <div className="h-full px-3 py-4 overflow-y-auto bg-white dark:bg-gray-800">
          <ul className="space-y-2 font-medium">
            {navigation.map((item) => (
              <li key={item.name}>
                <Link
                  to={item.href}
                  className={`flex items-center p-2 text-gray-900 rounded-lg dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 group ${
                    location.pathname === item.href 
                      ? 'bg-gray-100 dark:bg-gray-700'
                      : ''
                  }`}
                  onClick={() => setOpen(false)}
                >
                  <item.icon className="w-5 h-5 text-gray-500 transition duration-75 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white" />
                  <span className="ml-3">{item.name}</span>
                </Link>
              </li>
            ))}
          </ul>
          
          <div className="pt-5 mt-5 space-y-2 border-t border-gray-200 dark:border-gray-700">
            <Link
              to="/quizzes/new"
              className="flex items-center p-2 text-white rounded-lg bg-primary-600 hover:bg-primary-700 transition-colors"
              onClick={() => setOpen(false)}
            >
              <span className="flex-1 ml-3 whitespace-nowrap">Create New Quiz</span>
            </Link>
            
            <Link
              to="/projects/new"
              className="flex items-center p-2 text-gray-900 transition-colors rounded-lg bg-gray-100 hover:bg-gray-200 dark:text-white dark:bg-gray-700 dark:hover:bg-gray-600"
              onClick={() => setOpen(false)}
            >
              <span className="flex-1 ml-3 whitespace-nowrap">Create New Project</span>
            </Link>
          </div>
        </div>
      </div>
      
      {/* Overlay for mobile */}
      {open && (
        <div 
          className="fixed inset-0 z-30 bg-gray-900 bg-opacity-50 dark:bg-opacity-80 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
};

export default Sidebar;