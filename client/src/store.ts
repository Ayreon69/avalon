// État client : vue de la table reçue du serveur, session, profil et préférences locales.
import { create } from 'zustand';
import { AVATARS, type RoomView } from '../../shared/protocol';

export interface Session {
  code: string;
  playerId: string;
  token: string;
}
export interface Profile {
  name: string;
  avatar: string;
}
export interface Prefs {
  sound: boolean;
}
export interface Emote {
  id: number;
  playerId: string;
  emoji: string;
}
export interface Toast {
  id: number;
  text: string;
  tone: 'error' | 'info';
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* stockage indisponible : on continue sans */
  }
}

interface State {
  conn: 'connecting' | 'online' | 'offline';
  everConnected: boolean;
  view: RoomView | null;
  session: Session | null;
  profile: Profile;
  prefs: Prefs;
  clockOffset: number;
  emotes: Emote[];
  toast: Toast | null;
  rulesOpen: boolean;
  /** La fiche de rôle ouverte. */
  roleOpen: boolean;
  chatOpen: boolean;
  /** Dernier message de la discussion déjà vu, pour la pastille des messages non lus. */
  chatSeen: number;
  setConn: (c: State['conn']) => void;
  setView: (v: RoomView | null) => void;
  setSession: (s: Session | null) => void;
  setProfile: (p: Partial<Profile>) => void;
  setPrefs: (p: Partial<Prefs>) => void;
  pushEmote: (e: Omit<Emote, 'id'>) => void;
  showToast: (text: string, tone?: Toast['tone']) => void;
  setRulesOpen: (open: boolean) => void;
  setRoleOpen: (open: boolean) => void;
  setChatOpen: (open: boolean) => void;
  markChatSeen: (id: number) => void;
}

let seq = 0;
const defaultProfile: Profile = { name: '', avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)] };

export const useStore = create<State>((set, get) => ({
  conn: 'connecting',
  everConnected: false,
  view: null,
  session: (() => {
    const s = load<Session | null>('av.session', null);
    return s && s.code && s.token ? s : null;
  })(),
  profile: load('av.profile', defaultProfile),
  prefs: load('av.prefs', { sound: true }),
  clockOffset: 0,
  emotes: [],
  toast: null,
  rulesOpen: false,
  roleOpen: false,
  chatOpen: false,
  chatSeen: 0,
  setConn: (conn) => set((s) => ({ conn, everConnected: s.everConnected || conn === 'online' })),
  setView: (view) => set({ view, clockOffset: view ? view.serverNow - Date.now() : get().clockOffset }),
  setSession: (session) => {
    save('av.session', session);
    set({ session });
  },
  setProfile: (p) => {
    const profile = { ...get().profile, ...p };
    save('av.profile', profile);
    set({ profile });
  },
  setPrefs: (p) => {
    const prefs = { ...get().prefs, ...p };
    save('av.prefs', prefs);
    set({ prefs });
  },
  pushEmote: (e) => {
    const id = ++seq;
    set((s) => ({ emotes: [...s.emotes, { ...e, id }] }));
    setTimeout(() => set((s) => ({ emotes: s.emotes.filter((x) => x.id !== id) })), 3000);
  },
  showToast: (text, tone = 'error') => {
    const id = ++seq;
    set({ toast: { id, text, tone } });
    setTimeout(() => {
      if (get().toast?.id === id) set({ toast: null });
    }, 3600);
  },
  setRulesOpen: (rulesOpen) => set({ rulesOpen }),
  setRoleOpen: (roleOpen) => set({ roleOpen }),
  setChatOpen: (chatOpen) => set({ chatOpen }),
  markChatSeen: (id) => set((s) => (id > s.chatSeen ? { chatSeen: id } : s)),
}));

/** Heure du serveur estimée côté client (pour les comptes à rebours). */
export function serverNow(): number {
  return Date.now() + useStore.getState().clockOffset;
}
