// Contrat partagé entre le serveur et le client : rôles, quêtes, réglages et vues de table.

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 10;

/** Combien de sbires de Mordred selon le nombre de joueurs (livret officiel). */
export const EVIL_COUNT: Record<number, number> = { 5: 2, 6: 2, 7: 3, 8: 3, 9: 3, 10: 4 };

/** Taille de l'équipe de chaque quête, selon le nombre de joueurs. */
export const QUEST_SIZES: Record<number, number[]> = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 4, 5, 5],
};

/** À partir de 7 joueurs, la 4e quête n'échoue qu'avec deux cartes Échec. */
export function failsNeeded(players: number, quest: number): number {
  return players >= 7 && quest === 3 ? 2 : 1;
}

/** Cinq équipes rejetées d'affilée pendant une même quête : le Mal gagne. */
export const MAX_REJECTS = 5;
export const QUESTS = 5;
export const WINNING_QUESTS = 3;

export type Side = 'good' | 'evil';
export type Role = 'merlin' | 'perceval' | 'servant' | 'assassin' | 'morgane' | 'mordred' | 'oberon' | 'minion';

export const SIDE: Record<Role, Side> = {
  merlin: 'good',
  perceval: 'good',
  servant: 'good',
  assassin: 'evil',
  morgane: 'evil',
  mordred: 'evil',
  oberon: 'evil',
  minion: 'evil',
};

export const ROLE_NAMES: Record<Role, string> = {
  merlin: 'Merlin',
  perceval: 'Perceval',
  servant: 'Serviteur loyal d’Arthur',
  assassin: 'L’Assassin',
  morgane: 'Morgane',
  mordred: 'Mordred',
  oberon: 'Oberon',
  minion: 'Sbire de Mordred',
};

export type Talk = 'oral' | 'ecrit';
/** Temps laissé au meneur pour proposer son équipe, en secondes (0 : sans limite). */
export const TIMER_OPTIONS = [0, 120, 240] as const;
export type Timer = (typeof TIMER_OPTIONS)[number];

export interface Settings {
  /** Perceval et Morgane entrent en jeu ensemble. */
  perceval: boolean;
  mordred: boolean;
  oberon: boolean;
  lady: boolean;
  talk: Talk;
  timer: Timer;
}

/** Les rôles spéciaux du Mal demandés par les réglages, Assassin compris. */
export function evilSpecials(s: Pick<Settings, 'perceval' | 'mordred' | 'oberon'>): Role[] {
  const roles: Role[] = ['assassin'];
  if (s.perceval) roles.push('morgane');
  if (s.mordred) roles.push('mordred');
  if (s.oberon) roles.push('oberon');
  return roles;
}

/** null si les rôles tiennent dans le camp du Mal, sinon la raison. */
export function rolesProblem(s: Settings, players: number): string | null {
  const evil = EVIL_COUNT[Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, players))];
  const specials = evilSpecials(s).length;
  return specials > evil ? `À ${players}, le Mal n'a que ${evil} places : retire Mordred ou Oberon.` : null;
}

export const AVATARS = ['lion', 'dragon', 'aigle', 'loup', 'cerf', 'hibou', 'sanglier', 'cygne', 'renard', 'ours', 'cheval', 'licorne'] as const;
export const EMOTES = ['🤔', '😇', '😈', '🗡️', '👀', '🙏'] as const;
export const TAUNTS = ['Je suis loyal !', 'Menteur !', 'Fais-moi confiance', 'Pas lui !', 'Je rejette', 'Bien joué'] as const;

export type PlayerStatus = 'lobby' | 'playing' | 'spectator';

export interface PlayerView {
  id: string;
  name: string;
  avatar: string;
  isBot: boolean;
  isHost: boolean;
  connected: boolean;
  autopilot: boolean;
  status: PlayerStatus;
  /** Parties gagnées à cette table. */
  wins: number;
}

export type Stage = 'night' | 'team' | 'vote' | 'votes' | 'quest' | 'reveal' | 'lady' | 'assassin' | 'over';

export type Card = 'success' | 'fail';

export interface QuestSlot {
  size: number;
  /** Cartes Échec qu'il faut pour la faire échouer. */
  needed: number;
  result: Card | null;
}

/** Ce que ton rôle te révèle d'un autre joueur. */
export type Glimpse = 'evil' | 'merlin-or-morgane' | 'merlin';

export interface Seen {
  id: string;
  as: Glimpse;
}

/** Ce que la Dame du Lac t'a montré. */
export interface LadyNote {
  target: string;
  side: Side;
}

export interface MyRole {
  role: Role;
  side: Side;
  /** Ce que ton rôle te fait voir des autres, dès la nuit. */
  sees: Seen[];
  ladyNotes: LadyNote[];
}

export type EventKind = 'start' | 'approved' | 'rejected' | 'success' | 'fail' | 'lady' | 'assassin-start';

/** Ce qui vient de se passer. Le serveur ne garde ces événements que quelques secondes : ce n'est pas un historique. */
export interface GameEvent {
  id: number;
  until: number;
  kind: EventKind;
  by?: string;
  target?: string;
  /** Quête concernée (0 à 4). */
  quest?: number;
}

export type VictoryReason = 'quests' | 'fails' | 'rejects' | 'assassinated' | 'missed';

export interface Victory {
  side: Side;
  reason: VictoryReason;
  /** L'assassinat : qui a été visé. */
  target?: string;
}

export interface ChatMessage {
  id: number;
  by: string;
  text: string;
}

export interface GameView {
  order: string[];
  stage: Stage;
  /** Numéro d'état : une action envoyée pour un état déjà passé est refusée. */
  seq: number;
  quest: number;
  quests: QuestSlot[];
  /** Équipes rejetées d'affilée pendant cette quête. */
  rejects: number;
  leaderId: string;
  /** L'équipe du meneur : en cours de choix (visible de tous), puis proposée et partie en quête. */
  team: string[];
  /** La nuit : ceux qui ont vu leur rôle. Au vote : ceux qui ont voté. En quête : ceux qui ont joué. */
  done: string[];
  /** Les votes, dévoilés tous ensemble à la fin du vote, puis oubliés au tour suivant. */
  votes: Record<string, boolean> | null;
  approved: boolean | null;
  myVote: boolean | null;
  myCard: Card | null;
  /** Les cartes de la quête, mélangées : on sait combien d'Échec, jamais qui les a jouées. */
  reveal: Card[] | null;
  /** La Dame du Lac : qui la tient, et qui ne peut plus être sondé. */
  ladyId: string | null;
  ladyUsed: string[];
  /** Pendant l'assassinat, l'Assassin se dévoile. */
  assassinId: string | null;
  /** Date limite de l'action en cours (0 : sans limite). */
  endsAt: number;
  me: MyRole | null;
  victory: Victory | null;
  events: GameEvent[];
  chat: ChatMessage[];
}

export interface FinalPlayer {
  id: string;
  name: string;
  avatar: string;
  role: Role;
  side: Side;
  wins: number;
  winner: boolean;
}

export interface FinalView {
  victory: Victory;
  quests: QuestSlot[];
  players: FinalPlayer[];
  /** Celui qui a été assassiné ou visé, s'il y a eu assassinat. */
  target: string | null;
}

export interface RoomView {
  code: string;
  phase: 'lobby' | 'playing' | 'finished';
  me: string;
  hostId: string;
  settings: Settings;
  players: PlayerView[];
  game: GameView | null;
  final: FinalView | null;
  serverNow: number;
}

export type Ack<T = unknown> = (res: { ok: boolean; error?: string; data?: T }) => void;
