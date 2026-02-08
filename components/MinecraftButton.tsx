
import React from 'react';

interface MinecraftButtonProps {
  onClick?: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'active';
  className?: string;
  disabled?: boolean;
}

const MinecraftButton: React.FC<MinecraftButtonProps> = ({ 
  onClick, 
  children, 
  variant = 'primary', 
  className = '',
  disabled = false
}) => {
  const getColors = () => {
    switch(variant) {
      case 'danger': return 'bg-red-700 border-red-900 hover:bg-red-600 active:bg-red-800 text-white';
      case 'secondary': return 'bg-gray-700 border-gray-900 hover:bg-gray-600 active:bg-gray-800 text-white';
      case 'active': return 'bg-blue-600 border-blue-800 hover:bg-blue-500 active:bg-blue-700 text-white animate-pulse';
      default: return 'bg-green-700 border-green-900 hover:bg-green-600 active:bg-green-800 text-white';
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        relative px-2 py-1 border-b-2 border-r-2 transition-all duration-75
        flex items-center justify-center gap-1
        ${getColors()}
        ${disabled ? 'opacity-50 cursor-not-allowed grayscale' : 'cursor-pointer'}
        ${className}
      `}
      style={{
        boxShadow: 'inset 1px 1px 0px rgba(255,255,255,0.2), inset -1px -1px 0px rgba(0,0,0,0.2)',
      }}
    >
      <span className="text-[7px] md:text-[8px] uppercase tracking-tighter whitespace-nowrap">{children}</span>
    </button>
  );
};

export default MinecraftButton;
