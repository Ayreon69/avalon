// Moteur d'Avalon, sans réseau ni minuterie : rôles, nuit, équipes, votes, quêtes, Dame du Lac et assassinat.
import crypto from 'node:crypto';
import {
  EVIL_COUNT,
  MAX_REJECTS,
  QUESTS,
  QUEST_SIZES,
  SIDE,
  WINNING_QUESTS,
  evilSpecials,
  failsNeeded,
  type Card,
  type EventKind,
  type GameEvent,
  type LadyNote,
  type QuestSlot,
  type Role,
  type Seen,
  type Settings,
  type Side,
  type Stage,
  type Victory,
} from '../shared/protocol';

export function shuffle<T>(list: T[], rng: () => number = () => crypto.randomInt(1 << 30) / (1 << 30)): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/** Distribue les rôles : les spéciaux demandés, complétés par des serviteurs loyaux et des sbires. */
export function dealRoles(count: number, settings: Pick<Settings, 'perceval' | 'mordred' | 'oberon'>, rng?: () => number): Role[] {
  const evil = EVIL_COUNT[count];
  const bad = evilSpecials(settings).slice(0, evil);
  while (bad.length < evil) bad.push('minion');
  const good: Role[] = ['merlin'];
  if (settings.perceval) good.push('perceval');
  while (good.length < count - evil) good.push('servant');
  return shuffle([...good, ...bad], rng);
}

export interface GameOptions {
  /** Les rôles imposés (tests) ; sinon tirés au hasard. */
  roles?: Role[];
  /** Le premier meneur (tests) ; sinon tiré au hasard. */
  leader?: number;
  eventMs?: number;
  rng?: () => number;
}

/** Le résultat d'un vote, tel que tout le monde le voit une fois les bulletins retournés. */
export interface VoteResult {
  quest: number;
  /** Équipes déjà rejetées pendant cette quête avant ce vote (4 : dernière chance). */
  rejects: number;
  leader: string;
  team: string[];
  votes: Record<string, boolean>;
  approved: boolean;
}

/** Le résultat d'une quête : l'équipe et le nombre de cartes Échec. */
export interface QuestResult {
  quest: number;
  team: string[];
  fails: number;
  result: Card;
}

export class Game {
  readonly order: string[];
  readonly roles = new Map<string, Role>();
  readonly settings: Settings;
  readonly sizes: number[];
  stage: Stage = 'night';
  seq = 0;
  quest = 0;
  quests: QuestSlot[];
  rejects = 0;
  leaderIdx: number;
  team: string[] = [];
  ready = new Set<string>();
  votes = new Map<string, boolean>();
  lastVote: VoteResult | null = null;
  cards = new Map<string, Card>();
  reveal: Card[] | null = null;
  lastQuest: QuestResult | null = null;
  ladyId: string | null = null;
  ladyUsed: string[] = [];
  ladyNotes = new Map<string, LadyNote[]>();
  victory: Victory | null = null;
  events: GameEvent[] = [];
  /** Nombre de propositions d'équipe, pour mesurer la longueur des parties. */
  proposals = 0;

  private eventSeq = 0;
  private readonly eventMs: number;
  private readonly rng?: () => number;

  constructor(order: string[], settings: Settings, opts: GameOptions = {}) {
    this.order = [...order];
    this.settings = { ...settings };
    this.eventMs = opts.eventMs ?? 3_200;
    this.rng = opts.rng;
    const n = order.length;
    this.sizes = QUEST_SIZES[n];
    if (!this.sizes) throw new Error(`Avalon se joue de 5 à 10 joueurs, pas ${n}.`);
    const roles = opts.roles ?? dealRoles(n, settings, opts.rng);
    order.forEach((id, i) => this.roles.set(id, roles[i]));
    this.quests = this.sizes.map((size, q) => ({ size, needed: failsNeeded(n, q), result: null }));
    this.leaderIdx = opts.leader ?? Math.floor((opts.rng ?? Math.random)() * n);
    // La Dame du Lac commence à la droite du premier meneur.
    if (settings.lady) this.ladyId = order[(this.leaderIdx - 1 + n) % n];
  }

  get n(): number {
    return this.order.length;
  }

  get leader(): string {
    return this.order[this.leaderIdx];
  }

  get size(): number {
    return this.sizes[this.quest];
  }

  role(id: string): Role {
    return this.roles.get(id)!;
  }

  side(id: string): Side {
    return SIDE[this.role(id)];
  }

  idsWith(role: Role): string[] {
    return this.order.filter((id) => this.roles.get(id) === role);
  }

  get assassinId(): string | null {
    return this.idsWith('assassin')[0] ?? null;
  }

  count(result: Card): number {
    return this.quests.filter((q) => q.result === result).length;
  }

  /** Ce que le rôle de chacun lui fait voir dès la nuit. */
  sees(id: string): Seen[] {
    const role = this.role(id);
    const others = this.order.filter((o) => o !== id);
    if (role === 'merlin') return others.filter((o) => this.side(o) === 'evil' && this.role(o) !== 'mordred').map((o) => ({ id: o, as: 'evil' }));
    if (role === 'perceval') {
      const glimpse = this.settings.perceval && this.idsWith('morgane').length ? 'merlin-or-morgane' : 'merlin';
      return others.filter((o) => this.role(o) === 'merlin' || this.role(o) === 'morgane').map((o) => ({ id: o, as: glimpse }));
    }
    if (this.side(id) === 'evil' && role !== 'oberon') return others.filter((o) => this.side(o) === 'evil' && this.role(o) !== 'oberon').map((o) => ({ id: o, as: 'evil' }));
    return [];
  }

  /** Ceux dont on attend une action à cette étape. */
  waiting(): string[] {
    switch (this.stage) {
      case 'night':
        return this.order.filter((id) => !this.ready.has(id));
      case 'team':
        return [this.leader];
      case 'vote':
        return this.order.filter((id) => !this.votes.has(id));
      case 'quest':
        return this.team.filter((id) => !this.cards.has(id));
      case 'lady':
        return this.ladyId ? [this.ladyId] : [];
      case 'assassin':
        return this.assassinId ? [this.assassinId] : [];
      default:
        return [];
    }
  }

  private event(kind: EventKind, extra: Omit<GameEvent, 'id' | 'until' | 'kind'> = {}): void {
    const now = Date.now();
    // Seuls les derniers moments comptent : jamais de quoi reconstituer la partie.
    this.events = [...this.events.filter((e) => e.until > now), { id: ++this.eventSeq, until: now + this.eventMs, kind, ...extra }].slice(-3);
  }

  private bump(): void {
    this.seq++;
  }

  // ───────────────────────────── La nuit ─────────────────────────────

  markReady(id: string): string | undefined {
    if (this.stage !== 'night') return undefined;
    if (!this.roles.has(id)) return "Tu n'es pas à la table.";
    this.ready.add(id);
    if (this.ready.size === this.n) this.toTeam(true);
    return undefined;
  }

  private toTeam(first = false): void {
    this.stage = 'team';
    this.team = [];
    this.votes.clear();
    this.cards.clear();
    this.reveal = null;
    if (first) this.event('start', { by: this.leader });
    this.bump();
  }

  private nextLeader(): void {
    this.leaderIdx = (this.leaderIdx + 1) % this.n;
  }

  // ───────────────────────────── L'équipe ─────────────────────────────

  /** Le meneur ajoute ou retire un chevalier ; tout le monde voit l'équipe se former. */
  toggle(by: string, target: unknown): string | undefined {
    if (this.stage !== 'team') return "Ce n'est pas le moment de former l'équipe.";
    if (by !== this.leader) return "C'est au meneur de choisir l'équipe.";
    if (typeof target !== 'string' || !this.roles.has(target)) return 'Joueur introuvable.';
    if (this.team.includes(target)) this.team = this.team.filter((id) => id !== target);
    else {
      if (this.team.length >= this.size) return `L'équipe compte ${this.size} chevaliers : retires-en un d'abord.`;
      this.team = [...this.team, target];
    }
    return undefined;
  }

  /** Toute l'équipe d'un coup (bots, pilote automatique). */
  setTeam(by: string, ids: string[]): string | undefined {
    if (this.stage !== 'team') return "Ce n'est pas le moment de former l'équipe.";
    if (by !== this.leader) return "C'est au meneur de choisir l'équipe.";
    const unique = [...new Set(ids)];
    if (unique.length !== this.size || unique.some((id) => !this.roles.has(id))) return 'Équipe invalide.';
    this.team = unique;
    return undefined;
  }

  propose(by: string): string | undefined {
    if (this.stage !== 'team') return "Ce n'est pas le moment de proposer une équipe.";
    if (by !== this.leader) return "C'est au meneur de proposer l'équipe.";
    if (this.team.length !== this.size) return `Choisis ${this.size} chevaliers pour cette quête.`;
    this.stage = 'vote';
    this.votes.clear();
    this.proposals++;
    this.bump();
    return undefined;
  }

  // ───────────────────────────── Le vote ─────────────────────────────

  /** Chacun vote en secret, et peut changer d'avis tant que tout le monde n'a pas voté. */
  vote(by: string, approve: unknown): string | undefined {
    if (this.stage !== 'vote') return "Ce n'est pas le moment de voter.";
    if (!this.roles.has(by)) return "Tu n'es pas à la table.";
    if (typeof approve !== 'boolean') return 'Vote invalide.';
    this.votes.set(by, approve);
    if (this.votes.size === this.n) {
      const votes = Object.fromEntries(this.order.map((id) => [id, this.votes.get(id)!]));
      const yes = Object.values(votes).filter(Boolean).length;
      this.lastVote = { quest: this.quest, rejects: this.rejects, leader: this.leader, team: [...this.team], votes, approved: yes * 2 > this.n };
      this.stage = 'votes';
      this.event(this.lastVote.approved ? 'approved' : 'rejected', { by: this.leader, quest: this.quest });
      this.bump();
    }
    return undefined;
  }

  /** Après le dévoilement des votes : la quête part, ou le meneur passe la main. */
  afterVotes(): void {
    if (this.stage !== 'votes' || !this.lastVote) return;
    if (this.lastVote.approved) {
      this.rejects = 0;
      this.stage = 'quest';
      this.cards.clear();
      this.bump();
      return;
    }
    this.rejects++;
    if (this.rejects >= MAX_REJECTS) return this.finish({ side: 'evil', reason: 'rejects' });
    this.nextLeader();
    this.toTeam();
  }

  // ───────────────────────────── La quête ─────────────────────────────

  play(by: string, card: unknown): string | undefined {
    if (this.stage !== 'quest') return "Aucune quête n'est en cours.";
    if (!this.team.includes(by)) return "Tu ne fais pas partie de l'équipe.";
    if (this.cards.has(by)) return 'Ta carte est déjà jouée.';
    if (card !== 'success' && card !== 'fail') return 'Carte invalide.';
    if (card === 'fail' && this.side(by) === 'good') return 'Un loyal serviteur d’Arthur joue toujours Réussite.';
    this.cards.set(by, card);
    if (this.cards.size === this.team.length) {
      const cards = shuffle([...this.cards.values()], this.rng);
      const fails = cards.filter((c) => c === 'fail').length;
      this.reveal = cards;
      this.lastQuest = { quest: this.quest, team: [...this.team], fails, result: fails >= this.quests[this.quest].needed ? 'fail' : 'success' };
      this.stage = 'reveal';
      this.bump();
    }
    return undefined;
  }

  /** Les cartes dévoilées : le résultat se pose sur la table, puis la partie continue ou s'achève. */
  afterReveal(): void {
    if (this.stage !== 'reveal' || !this.lastQuest) return;
    const done = this.lastQuest;
    this.quests[done.quest].result = done.result;
    this.event(done.result, { quest: done.quest });
    this.reveal = null;
    if (this.count('fail') >= WINNING_QUESTS) return this.finish({ side: 'evil', reason: 'fails' });
    if (this.count('success') >= WINNING_QUESTS) {
      if (this.assassinId) {
        this.stage = 'assassin';
        this.team = [];
        this.event('assassin-start', { by: this.assassinId });
        this.bump();
        return;
      }
      return this.finish({ side: 'good', reason: 'quests' });
    }
    this.quest++;
    this.nextLeader();
    // La Dame du Lac sert après les quêtes 2, 3 et 4.
    if (this.ladyId && done.quest >= 1 && done.quest <= 3) {
      this.stage = 'lady';
      this.team = [];
      this.bump();
      return;
    }
    this.toTeam();
  }

  // ───────────────────────────── La Dame du Lac ─────────────────────────────

  ladyTargets(): string[] {
    if (!this.ladyId) return [];
    return this.order.filter((id) => id !== this.ladyId && !this.ladyUsed.includes(id));
  }

  /** La détentrice sonde la loyauté d'un joueur, puis lui confie la Dame du Lac. */
  examine(by: string, target: unknown): string | undefined {
    if (this.stage !== 'lady') return "Ce n'est pas le moment de la Dame du Lac.";
    if (by !== this.ladyId) return 'La Dame du Lac est entre d’autres mains.';
    if (typeof target !== 'string' || !this.ladyTargets().includes(target)) return 'Ce joueur ne peut pas être sondé.';
    const notes = this.ladyNotes.get(by) ?? [];
    notes.push({ target, side: this.side(target) });
    this.ladyNotes.set(by, notes);
    this.ladyUsed.push(by);
    this.ladyId = target;
    this.event('lady', { by, target });
    this.toTeam();
    return undefined;
  }

  // ───────────────────────────── L'assassinat ─────────────────────────────

  assassinate(by: string, target: unknown): string | undefined {
    if (this.stage !== 'assassin') return "Ce n'est pas le moment de l'assassinat.";
    if (by !== this.assassinId) return "Seul l'Assassin peut frapper.";
    if (typeof target !== 'string' || !this.roles.has(target) || target === by) return 'Cible invalide.';
    const hit = this.role(target) === 'merlin';
    this.finish({ side: hit ? 'evil' : 'good', reason: hit ? 'assassinated' : 'missed', target });
    return undefined;
  }

  private finish(v: Victory): void {
    this.victory = v;
    this.stage = 'over';
    this.bump();
  }

  winners(): string[] {
    return this.victory ? this.order.filter((id) => this.side(id) === this.victory!.side) : [];
  }
}
