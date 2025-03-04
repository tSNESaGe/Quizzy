// frontend/src/components/common/Button.jsx
import React from 'react';

// frontend/src/components/common/Button.jsx
// Enhance the Button component styling

const Button = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
  type = 'button',
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white border border-transparent focus:ring-blue-500 shadow-sm hover:shadow',
    secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 focus:ring-gray-500 hover:shadow',
    outline: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 focus:ring-blue-500 hover:text-blue-600 hover:border-blue-300',
    danger: 'bg-red-600 hover:bg-red-700 text-white border border-transparent focus:ring-red-500 shadow-sm hover:shadow',
    success: 'bg-green-600 hover:bg-green-700 text-white border border-transparent focus:ring-green-500 shadow-sm hover:shadow',
    link: 'text-blue-600 hover:text-blue-800 underline bg-transparent border-0 p-0 shadow-none'
  };
  
  const sizeClasses = {
    xs: 'text-xs px-2 py-1 rounded',
    sm: 'text-sm px-3 py-1.5 rounded',
    md: 'text-sm px-4 py-2 rounded-md',
    lg: 'text-base px-6 py-3 rounded-md'
  };
  
  const combinedClasses = `
    ${baseClasses}
    ${variantClasses[variant] || variantClasses.primary}
    ${sizeClasses[size] || sizeClasses.md}
    ${className}
  `;
  
  return (
    <button
      type={type}
      className={combinedClasses}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;