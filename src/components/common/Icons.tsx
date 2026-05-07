import React from 'react';
import { GiSoccerBall } from 'react-icons/gi';

export const SoccerIcon = ({ className }: { className?: string }) => {
  const Icon = GiSoccerBall as any;
  return <Icon className={className} />;
};

export const PitchIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="94" height="58" rx="4" />
    <line x1="50" y1="3" x2="50" y2="61" />
    <circle cx="50" cy="32" r="10" />
    <rect x="3" y="20" width="12" height="24" />
    <rect x="85" y="20" width="12" height="24" />
    <path d="M15 26a8 8 0 0 1 0 12" />
    <path d="M85 26a8 8 0 0 0 0 12" />
  </svg>
);

export const AppLogo = ({ className }: { className?: string }) => (
  <img 
    src="/android-192.png" 
    className={`${className} object-contain`} 
    alt="Kickivo Logo" 
    onError={(e) => {
      // Fallback to another uploaded size if primary fails
      (e.target as HTMLImageElement).src = '/ios-180.png';
    }}
  />
);
