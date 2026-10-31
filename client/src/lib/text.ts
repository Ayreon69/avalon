// Les mots de la table : noms, rôles, consignes de chaque étape et récit de la fin.
import { ROLE_NAMES, type GameEvent, type Glimpse, type Role, type RoomView, type Side, type Victory } from '../../../shared/protocol';

export function nameOf(view: RoomView, id: string | undefined | null): string {
  if (!id) return '?';
  if (id === view.me) return 'toi';
  return view.players.find((p) => p.id === id)?.name ?? '?';
}

/** Le nom en début de phrase : « Toi », « Gauvain ». */
export function Name(view: RoomView, id: string | undefined | null): string {
  return id === view.me ? 'Toi' : nameOf(view, id);
}

/** « Léa, Zino et Sam ». */
export function listing(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`;
}

export function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const SIDE_NAMES: Record<Side, string> = { good: 'Loyal à Arthur', evil: 'Au service de Mordred' };
export const SIDE_SHORT: Record<Side, string> = { good: 'le Bien', evil: 'le Mal' };

export function roleName(role: Role): string {
  return ROLE_NAMES[role];
}

/** Ce que chaque rôle doit savoir de lui-même, en deux phrases. */
export const ROLE_TEXT: Record<Role, string> = {
  merlin: 'Tu connais les sbires de Mordred. Guide les loyaux sans te dévoiler : si le Bien gagne, l’Assassin aura une chance de te démasquer.',
  perceval: 'Tu vois Merlin… et Morgane, qui se fait passer pour lui. Protège le vrai Merlin.',
  servant: 'Tu ne sais rien de plus que la table. Écoute, observe les votes, et fais réussir trois quêtes.',
  assassin: 'Tu sers Mordred. Si le Bien réussit trois quêtes, tu auras le dernier mot : trouve Merlin et frappe.',
  morgane: 'Tu sers Mordred. Aux yeux de Perceval, tu as le visage de Merlin : sème le doute.',
  mordred: 'Tu mènes les forces du Mal, et Merlin lui-même ne te voit pas.',
  oberon: 'Tu sers Mordred, mais seul : tes complices ne te connaissent pas, et tu ne les connais pas.',
  minion: 'Tu sers Mordred avec tes complices. Fais échouer trois quêtes sans te faire prendre.',
};

/** La ligne qui présente ce que le rôle fait voir. */
export function glimpseTitle(role: Role): string | null {
  if (role === 'merlin') return 'Les sbires de Mordred que tu vois';
  if (role === 'perceval') return 'Merlin, ou Morgane ?';
  if (role === 'oberon' || role === 'servant') return null;
  return 'Tes complices';
}

export function glimpseLabel(as: Glimpse): string {
  return as === 'evil' ? 'Sbire de Mordred' : as === 'merlin' ? 'Merlin' : 'Merlin ou Morgane';
}

/** Ce que le rôle ne voit pas, pour éviter les faux espoirs. */
export function blindSpot(role: Role, view: RoomView): string | null {
  const s = view.settings;
  if (role === 'merlin' && s.mordred) return 'Mordred se cache parmi les autres : tu ne le vois pas.';
  if (role !== 'oberon' && role !== 'merlin' && role !== 'perceval' && role !== 'servant' && s.oberon) return 'Oberon sert aussi Mordred, mais vous ne vous connaissez pas.';
  return null;
}

export function questLabel(q: number): string {
  return ['Première', 'Deuxième', 'Troisième', 'Quatrième', 'Cinquième'][q] ?? `Quête ${q + 1}`;
}

/** Le dénouement, raconté. */
export function victoryTitle(v: Victory): string {
  return v.side === 'good' ? 'Le Bien triomphe' : 'Mordred l’emporte';
}

export function victoryText(view: RoomView, v: Victory): string {
  const target = v.target ? nameOf(view, v.target) : '';
  switch (v.reason) {
    case 'quests':
      return 'Trois quêtes ont été accomplies.';
    case 'missed':
      return `Trois quêtes réussies, et l’Assassin a frappé à côté : ${target === 'toi' ? 'tu n’étais' : `${target} n’était`} pas Merlin.`;
    case 'assassinated':
      return `Trois quêtes réussies… mais l’Assassin a démasqué Merlin : ${target === 'toi' ? 'toi' : target}.`;
    case 'fails':
      return 'Trois quêtes ont échoué.';
    case 'rejects':
      return 'Cinq équipes rejetées d’affilée : le royaume sombre dans la discorde.';
  }
}

/** Ce qui vient de se passer, en une phrase ; null pour ce qui se voit déjà ailleurs. */
export function eventText(view: RoomView, e: GameEvent): string | null {
  switch (e.kind) {
    case 'start':
      return e.by === view.me ? 'Tu es le premier meneur.' : `${nameOf(view, e.by)} est le premier meneur.`;
    case 'lady':
      return `${Name(view, e.by)} ${e.by === view.me ? 'as' : 'a'} sondé ${nameOf(view, e.target)} avec la Dame du Lac.`;
    case 'assassin-start':
      return null;
    default:
      return null;
  }
}
