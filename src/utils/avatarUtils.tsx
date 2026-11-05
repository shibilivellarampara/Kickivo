import React from 'react';
import { 
  Shield, 
  User 
} from 'lucide-react';

export interface DefaultItem {
  id: string; // e.g. "emblem:shield-blue"
  name: string;
  icon: React.ComponentType<any>;
  gradientClass: string;
  textClass: string;
}

export const DEFAULT_EMBLEMS: DefaultItem[] = [
  { id: 'emblem:shield-royal', name: 'Royal Shield', icon: Shield, gradientClass: 'from-blue-600 to-indigo-800', textClass: 'text-white' },
  { id: 'emblem:shield-emerald', name: 'Emerald Shield', icon: Shield, gradientClass: 'from-emerald-500 to-teal-800', textClass: 'text-white' },
  { id: 'emblem:shield-ruby', name: 'Ruby Shield', icon: Shield, gradientClass: 'from-rose-500 to-red-800', textClass: 'text-white' },
  { id: 'emblem:shield-amber', name: 'Amber Shield', icon: Shield, gradientClass: 'from-amber-400 to-orange-700', textClass: 'text-white' },
  { id: 'emblem:shield-cosmic', name: 'Cosmic Shield', icon: Shield, gradientClass: 'from-purple-600 to-indigo-950', textClass: 'text-white' },
  { id: 'emblem:shield-gold', name: 'Golden Shield', icon: Shield, gradientClass: 'from-yellow-400 to-amber-700', textClass: 'text-white' },
  { id: 'emblem:shield-sky', name: 'Sky Shield', icon: Shield, gradientClass: 'from-sky-500 to-blue-700', textClass: 'text-white' },
  { id: 'emblem:shield-slate', name: 'Slate Shield', icon: Shield, gradientClass: 'from-slate-600 to-slate-800', textClass: 'text-white' },
];

export const DEFAULT_AVATARS: DefaultItem[] = [
  { id: 'avatar:user-blue', name: 'Blue Player', icon: User, gradientClass: 'from-blue-100 to-indigo-200', textClass: 'text-blue-600' },
  { id: 'avatar:user-green', name: 'Green Player', icon: User, gradientClass: 'from-emerald-100 to-teal-200', textClass: 'text-emerald-700' },
  { id: 'avatar:user-amber', name: 'Amber Player', icon: User, gradientClass: 'from-amber-100 to-orange-200', textClass: 'text-amber-700' },
  { id: 'avatar:user-red', name: 'Red Player', icon: User, gradientClass: 'from-rose-100 to-pink-200', textClass: 'text-rose-600' },
  { id: 'avatar:user-purple', name: 'Purple Player', icon: User, gradientClass: 'from-purple-100 to-fuchsia-200', textClass: 'text-purple-600' },
  { id: 'avatar:user-slate', name: 'Slate Player', icon: User, gradientClass: 'from-slate-150 to-slate-300', textClass: 'text-slate-600' },
  { id: 'avatar:user-gold', name: 'Gold Player', icon: User, gradientClass: 'from-yellow-100 to-yellow-300', textClass: 'text-amber-700' },
  { id: 'avatar:user-cyan', name: 'Cyan Player', icon: User, gradientClass: 'from-cyan-100 to-sky-200', textClass: 'text-cyan-600' },
];

// Fallback to select default design strictly based on a string name hash or id
export const getDeterministicEmblem = (name: string): DefaultItem => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % DEFAULT_EMBLEMS.length;
  return DEFAULT_EMBLEMS[index];
};

export const getDeterministicAvatar = (name: string, number?: number): DefaultItem => {
  if (number) {
    return DEFAULT_AVATARS[number % DEFAULT_AVATARS.length];
  }
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % DEFAULT_AVATARS.length;
  return DEFAULT_AVATARS[index];
};

export const renderTeamLogo = (logoURL: string | undefined, name: string, className = "w-10 h-10") => {
  if (logoURL && logoURL.startsWith('http')) {
    return (
      <img 
        src={logoURL} 
        referrerPolicy="no-referrer"
        className={`${className} rounded-full object-contain bg-white shadow-sm border border-slate-100 shrink-0`} 
        alt={name} 
      />
    );
  } else if (logoURL && logoURL.startsWith('data:image')) {
    return (
      <img 
        src={logoURL} 
        className={`${className} rounded-full object-contain bg-white shadow-sm border border-slate-100 shrink-0`} 
        alt={name} 
      />
    );
  } else if (logoURL && logoURL.startsWith('emblem:')) {
    const emblem = DEFAULT_EMBLEMS.find(e => e.id === logoURL) || DEFAULT_EMBLEMS[0];
    const Icon = emblem.icon;
    return (
      <div className={`${className} rounded-full bg-gradient-to-br ${emblem.gradientClass} flex items-center justify-center border border-white/10 shadow-sm shrink-0`}>
        <Icon className="w-1/2 h-1/2 text-white" />
      </div>
    );
  } else {
    // Deterministic fallback based on team name
    const emblem = getDeterministicEmblem(name);
    const Icon = emblem.icon;
    return (
      <div className={`${className} rounded-full bg-gradient-to-br ${emblem.gradientClass} flex items-center justify-center border border-white/10 shadow-sm shrink-0`}>
        <Icon className="w-1/2 h-1/2 text-white" />
      </div>
    );
  }
};

export const renderPlayerAvatar = (photoURL: string | undefined, name: string, className = "w-10 h-10", number?: number) => {
  const roundedClass = className.includes('rounded-') ? '' : 'rounded-2xl';
  if (photoURL && photoURL.startsWith('http')) {
    return (
      <img 
        src={photoURL} 
        referrerPolicy="no-referrer"
        className={`${className} ${roundedClass} object-cover border border-slate-200 bg-white shadow-sm shrink-0`} 
        alt={name} 
      />
    );
  } else if (photoURL && photoURL.startsWith('data:image')) {
    return (
      <img 
        src={photoURL} 
        className={`${className} ${roundedClass} object-cover border border-slate-200 bg-white shadow-sm shrink-0`} 
        alt={name} 
      />
    );
  } else if (photoURL && photoURL.startsWith('avatar:')) {
    const avatar = DEFAULT_AVATARS.find(a => a.id === photoURL) || DEFAULT_AVATARS[0];
    const Icon = avatar.icon;
    return (
      <div className={`${className} ${roundedClass} bg-gradient-to-br ${avatar.gradientClass} flex items-center justify-center border border-slate-200 shadow-sm shrink-0`}>
        <Icon className={`w-1/2 h-1/2 ${avatar.textClass}`} />
      </div>
    );
  } else {
    // Deterministic fallback based on player name/number
    const avatar = getDeterministicAvatar(name, number);
    const Icon = avatar.icon;
    return (
      <div className={`${className} ${roundedClass} bg-gradient-to-br ${avatar.gradientClass} flex items-center justify-center border border-slate-200 shadow-sm shrink-0`}>
        <Icon className={`w-1/2 h-1/2 ${avatar.textClass}`} />
      </div>
    );
  }
};
