import React, { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Transition } from '@headlessui/react';
import { 
  Bars3Icon, 
  BellIcon, 
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';

const Navbar = ({ toggleSidebar }) => {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
  };

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-2.5 dark:bg-gray-800 dark:border-gray-700 fixed left-0 right-0 top-0 z-50">
      <div className="flex flex-wrap justify-between items-center">
        <div className="flex justify-start items-center">
          <button
            onClick={toggleSidebar}
            className="p-2 mr-2 text-gray-600 rounded-lg cursor-pointer md:hidden hover:text-gray-900 hover:bg-gray-100 focus:bg-gray-100 dark:focus:bg-gray-700 focus:ring-2 focus:ring-gray-100 dark:focus:ring-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
          >
            <Bars3Icon className="w-6 h-6" />
            <span className="sr-only">Toggle sidebar</span>
          </button>
          <Link to="/" className="flex items-center justify-between mr-4">
            <span className="self-center text-2xl font-semibold whitespace-nowrap dark:text-white">
              Quiz Generator
            </span>
          </Link>
        </div>
        
        <div className="flex items-center lg:order-2">
          {/* Notifications */}
          <button
            type="button"
            className="p-2 text-gray-500 rounded-lg hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700"
          >
            <BellIcon className="w-6 h-6" />
            <span className="sr-only">View notifications</span>
          </button>
          
          {/* User menu */}
          <Menu as="div" className="relative ml-3">
            <div>
              <Menu.Button className="flex items-center text-sm rounded-full hover:ring-4 hover:ring-gray-100 dark:hover:ring-gray-700 focus:outline-none">
                <span className="sr-only">Open user menu</span>
                <UserCircleIcon className="w-8 h-8 text-gray-600 dark:text-gray-300" />
              </Menu.Button>
            </div>
            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                <div className="px-4 py-3">
                  <p className="text-sm text-gray-900 dark:text-white">
                    {user?.username}
                  </p>
                  <p className="text-sm font-medium text-gray-500 truncate dark:text-gray-400">
                    {user?.email}
                  </p>
                </div>
                <hr className="border-gray-200 dark:border-gray-700" />
                
                <Menu.Item>
                  {({ active }) => (
                    <Link
                      to="/settings"
                      className={`${
                        active ? 'bg-gray-100 dark:bg-gray-700' : ''
                      } flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300`}
                    >
                      <Cog6ToothIcon className="w-5 h-5 mr-2 text-gray-500 dark:text-gray-400" />
                      Settings
                    </Link>
                  )}
                </Menu.Item>
                
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={handleLogout}
                      className={`${
                        active ? 'bg-gray-100 dark:bg-gray-700' : ''
                      } flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 w-full text-left`}
                    >
                      <ArrowRightOnRectangleIcon className="w-5 h-5 mr-2 text-gray-500 dark:text-gray-400" />
                      Logout
                    </button>
                  )}
                </Menu.Item>
              </Menu.Items>
            </Transition>
          </Menu>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;