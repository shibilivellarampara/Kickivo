import { Player, Team } from '../types';

export const positionOrder: Record<string, number> = {
  'FWD': 1,
  'MID': 2,
  'DEF': 3,
  'GK': 4,
  'SUB': 5
};

export const sortPlayersByPosition = (players: Player[]) => {
  return [...players].sort((a, b) => {
    const orderA = positionOrder[a.position || 'SUB'] || 99;
    const orderB = positionOrder[b.position || 'SUB'] || 99;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name);
  });
};

export const formatTeamName = (name: string) => {
  if (!name) return "";
  return name
    .replace(/\bFC\b/gi, '')
    .replace(/\bF\.C\.?\b/gi, '')
    .replace(/\bFootball Club\b/gi, '')
    .trim();
};

export const getTeamShortName = (team?: Team, placeholder?: string) => {
  if (team?.shortName) return team.shortName;
  if (team) {
    const original = team.name.trim();
    if (original.toUpperCase().startsWith("FC ")) {
      const words = original.split(/\s+/);
      if (words.length > 1) return ("FC" + words[1].charAt(0)).toUpperCase();
    }
    if (original.toUpperCase().endsWith(" FC")) {
      const words = original.split(/\s+/);
      if (words.length > 1) return (words[0].charAt(0) + "FC").toUpperCase();
    }
    const sanitized = formatTeamName(team.name);
    return sanitized.substring(0, 3).toUpperCase();
  }
  return placeholder ? placeholder.substring(0, 3).toUpperCase() : 'TBD';
};
