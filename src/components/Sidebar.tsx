import React from 'react';
import { TabType, StreakState } from '../types';
import {
  LayoutGrid,
  Calendar,
  UploadCloud,
  Calculator,
  Share2,
  Flame
} from 'lucide-react';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  onOpenSyncModal: () => void;
  streak: StreakState;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onOpenSyncModal,
  streak
}) => {
  const navItems = [
    { id: 'timeline' as TabType, label: 'Dashboard', icon: LayoutGrid },
    { id: 'calendar' as TabType, label: 'Schedule', icon: Calendar },
    { id: 'upload' as TabType, label: 'Import Syllabus', icon: UploadCloud },
    { id: 'calculator' as TabType, label: 'Grade Calc', icon: Calculator },
  ];

  return (
    <aside className="w-64 shrink-0 flex flex-col justify-between p-6 border-r border-slate-200 bg-caplen-sidebar min-h-screen select-none">
      <div>
        {/* Caplen Logo Brand - Crisp Black Styling */}
        <div 
          onClick={() => setActiveTab('timeline')}
          className="flex items-center gap-3 cursor-pointer mb-10 px-2 group"
        >
          <div className="h-10 w-10 rounded-2xl bg-caplen-navy text-white flex items-center justify-center font-heading font-extrabold text-xl shadow-md group-hover:scale-105 transition-transform">
            S
          </div>
          <div>
            <span className="font-heading text-2xl font-extrabold tracking-tight text-caplen-navy block">
              Syllaba
            </span>
            <span className="text-[10px] font-bold text-caplen-navy/80 block -mt-1 uppercase tracking-wider">
              100% Free AI Tracker
            </span>
          </div>
        </div>

        {/* Vertical Nav List with Sharp Black Icons */}
        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-extrabold transition-all duration-200 ${
                  isActive
                    ? 'bg-caplen-navy text-white shadow-md font-heading'
                    : 'text-caplen-navy hover:bg-slate-200/70'
                }`}
              >
                <Icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-vibrant-limeAccent' : 'text-caplen-navy'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}

          {/* Sync Trigger Item */}
          <button
            onClick={onOpenSyncModal}
            className="w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-extrabold text-caplen-navy hover:bg-slate-200/70 transition-all duration-200"
          >
            <Share2 className="h-5 w-5 text-caplen-navy shrink-0" />
            <span>Calendar Sync</span>
          </button>
        </nav>
      </div>

      {/* Sidebar Bottom Items */}
      <div className="pt-6 border-t border-slate-300/60 space-y-3">
        {/* Streak Pill */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs text-xs font-bold text-caplen-navy">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-amber-500 fill-amber-500 animate-bounce" />
            <span className="font-heading">Streak</span>
          </div>
          <span className="font-mono font-bold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200 number-display">
            {streak.currentStreak} Days
          </span>
        </div>

        {/* Free Plan Badge */}
        <div className="flex items-center justify-between text-xs px-2 text-caplen-navy font-semibold">
          <span>License</span>
          <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300 text-[10px]">
            100% Free & Open
          </span>
        </div>
      </div>
    </aside>
  );
};
