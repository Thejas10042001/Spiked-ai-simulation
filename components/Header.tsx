
import React from 'react';
import { ICONS } from '../constants';

export const Header: React.FC = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-effect border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-md">
            <ICONS.Brain />
          </div>
          <span className="font-extrabold text-xl tracking-tight text-slate-800">
            Cognitive<span className="text-indigo-600">Sales</span>
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-500">
          <a href="#" className="text-indigo-600">Intelligence</a>
          <a href="#" className="hover:text-slate-800 transition-colors">Documents</a>
          <a href="#" className="hover:text-slate-800 transition-colors">Team Strategy</a>
        </nav>

        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        </div>
      </div>
    </header>
  );
};
