import React from 'react';
import {
  LayoutDashboard,
  Sliders,
  Brain,
  Cpu,
  X,
} from 'lucide-react';
import { Logo } from '../common/Logo';

interface SidebarProps {
  activePage: string;
  onSelectPage: (pageId: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeColor?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'controls', label: 'Smart Controls', icon: Sliders, badge: 'PIR+PWM', badgeColor: 'bg-[#CBE5F6] text-[#1E40AF] border-[#A2D8E2]' },
  { id: 'predictions', label: 'AI Prediction', icon: Brain, badge: 'ML Forecast', badgeColor: 'bg-[#8BF0F0]/30 text-[#0F766E] border-[#A2D8E2]' },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onSelectPage,
  isOpen,
  onClose,
}) => {
  return (
    <>
      {/* Pop-over Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300"
          title="Click outside to close"
        />
      )}

      {/* Pop-up Drawer Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col w-72 bg-gradient-to-b from-white via-[#F4F9FD] to-[#E6F3FA] border-r-2 border-[#A2D8E2] shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header with Logo & Close button */}
        <div className="flex items-center justify-between h-16 px-5 border-b-2 border-[#A2D8E2]/60 bg-white/80">
          <Logo size="md" showText={true} />

          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-[#5C94ED] rounded-lg hover:bg-[#CBE5F6]/40 transition-colors"
            title="Close Menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation items: clicking selects page and closes drawer */}
        <nav className="flex-1 px-3.5 py-6 space-y-2.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectPage(item.id);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-bold transition-all group ${
                  isActive
                    ? 'bg-gradient-to-r from-[#CBE5F6] via-[#A2D8E2]/40 to-[#CBE5F6]/70 text-[#1E3A8A] border-2 border-[#5C94ED] shadow-sm'
                    : 'text-slate-700 hover:text-[#5C94ED] hover:bg-[#CBE5F6]/30 border border-transparent hover:border-[#A2D8E2]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-[#5C94ED]' : 'text-slate-500 group-hover:text-[#5C94ED]'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-md border font-semibold ${item.badgeColor}`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Node Hardware Summary Widget at bottom */}
        <div className="p-4 m-3.5 rounded-2xl bg-white/95 border-2 border-[#A2D8E2] text-xs shadow-xs">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-[#5C94ED]" />
              ESP32 Node
            </span>
            <span className="flex items-center gap-1 text-[10px] font-mono text-[#0F766E] bg-[#8BF0F0]/50 px-2 py-0.5 rounded-full border border-[#A2D8E2] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0D9488] animate-pulse"></span>
              Online
            </span>
          </div>

          <div className="space-y-1.5 text-[11px] text-slate-600 font-mono">
            <div className="flex justify-between">
              <span className="text-slate-500">MCU:</span>
              <span className="text-slate-800 font-bold">ESP32 DevKit V1</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Sensors:</span>
              <span className="text-slate-800 font-bold">ACS712 + LDR + PIR</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Actuators:</span>
              <span className="text-slate-800 font-bold">Relay + PWM Fan</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
