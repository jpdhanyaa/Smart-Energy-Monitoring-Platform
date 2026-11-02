import React from 'react';
import {
  Cpu,
  Menu,
} from 'lucide-react';
import { Logo } from '../common/Logo';

interface NavbarProps {
  onToggleSidebar: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onToggleSidebar,
}) => {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-6 bg-white/90 backdrop-blur-md border-b-2 border-[#A2D8E2] shadow-[0_4px_20px_rgba(92,148,237,0.08)]">
      {/* Left: Menu trigger, Logo, and Heading */}
      <div className="flex items-center gap-3.5">
        <button
          onClick={onToggleSidebar}
          className="flex items-center gap-2 p-2 sm:px-3 sm:py-2 text-[#0F172A] hover:text-[#5C94ED] rounded-xl bg-[#CBE5F6]/50 hover:bg-[#CBE5F6] border border-[#A2D8E2] transition-colors shadow-xs"
          title="Open Navigation Menu"
        >
          <Menu className="w-5 h-5 text-[#5C94ED]" />
          <span className="text-xs font-bold hidden sm:inline text-slate-800">Menu</span>
        </button>

        {/* Logo emblem */}
        <Logo size="sm" />

        {/* Heading strictly alone without stacked subtitles */}
        <h1 className="text-base sm:text-lg md:text-xl font-extrabold tracking-tight text-[#0F172A]">
          AI Smart Energy Management
        </h1>
      </div>

      {/* Right: ESP32 Connection Status Badge in Ice Blue / Cornflower */}
      <div className="flex items-center gap-2">
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#CBE5F6]/50 border border-[#A2D8E2] text-xs font-mono shadow-xs"
          title="ESP32 DevKit V1 Hardware Node Active"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#5C94ED] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#5C94ED]"></span>
          </span>
          <Cpu className="w-3.5 h-3.5 text-[#5C94ED]" />
          <span className="text-[#1E293B] font-semibold">ESP32 Online</span>
        </div>
      </div>
    </header>
  );
};
