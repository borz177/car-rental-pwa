
import React from 'react';

interface TopNavbarProps {
  brandName: string;
}

const TopNavbar: React.FC<TopNavbarProps> = ({ brandName }) => {
  return (
    <div className="md:hidden fixed top-0 left-0 right-0 pt-safe min-h-[4.5rem] bg-white/80 backdrop-blur-xl border-b border-slate-200 z-40 px-6 flex items-center justify-between shadow-sm">
      <div className="flex items-center space-x-3 py-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
          <i className="fas fa-car-side text-xs"></i>
        </div>
        <span className="font-black text-slate-800 tracking-tight truncate max-w-[200px]">
          {brandName || 'AutoPro AI'}
        </span>
      </div>
      <div className="flex items-center space-x-4 py-3">
        <button className="text-slate-400 hover:text-blue-600 transition-colors p-2">
          <i className="fas fa-bell"></i>
        </button>
      </div>
    </div>
  );
};

export default TopNavbar;
