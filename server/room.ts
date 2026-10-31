// Une table d'Avalon : salon, partie, minuteries, bots, pilote automatique, messagerie et vue de chacun.
import crypto from 'node:crypto';
import {
  AVATARS,
  EVIL_COUNT,
  MAX_PLAYERS,
  MIN_PLAYERS,
  TIMER_OPTIONS,
  rolesProblem,
  type ChatMessage,
  type FinalView,
  type GameView,
  type PlayerStatus,
  type RoomView,
  type Settings,
  type Timer,
} from '../shared/protocol';
import { Mind, botAssassin, botCard, botLady, botTeam, botVote, randomSkill, type Skill } from './bots';
import { Game, shuffle } from './game';

const BOT_NAMES = ['Gauvain', 'Lancelot', 'Tristan', 'Yvain', 'Bohort', 'Galaad', 'Keu', 'Lionel', 'Sagremor', 'Gareth', 'Bédivère', 'Lamorak'];
const MAX_MEMBERS = 16;
/** Délai laissé à un joueur déconnecté avant que le pilote automatique ne prenne le relais. */
const GRACE_MS = 20_000;
/** Mode accéléré pour les tests locaux (AV_FAST=1) : bots et chronos quasi instantanés. */
const FAST = process.env.AV_FAST === '1';
const EVENT_MS = FAST ? 300 : 3_400;
/** La nuit ne s'éternise pas : passé ce délai, la partie commence. */
const NIGHT_MS = FAST ? 800 : 60_000;
/** Le temps de lire tous les votes, retournés ensemble. */
const VOTES_MS = FAST ? 60 : 6_000;
/** Les cartes de quête se retournent une à une, puis le résultat se pose. */
const REVEAL_BASE_MS = FAST ? 40 : 1_700;
const REVEAL_CARD_MS = FAST ? 10 : 1_150;
const REVEAL_TAIL_MS = FAST ? 40 : 2_600;
/** Le temps de savourer la fin avant l'écran des rôles. */
const WIN_MS = FAST ? 120 : 4_200;
/** Avec un chrono, le temps laissé pour un vote, une carte de quête ou la Dame du Lac. */
const QUICK_MS = 45_000;
const CHAT_KEEP = 40;
const PILOT_SKILL: Skill = { forget: 0, noise: 0.1, bluff: 0.2 };

export interface Player {
  id: string;
  token: string;
  name: string;
  avatar: string;
  isBot: boolean;
  sockets: Set<string>;
  connected: boolean;
  disconnectedAt: number;
  left: boolean;
  status: PlayerStatus;
}

function uid(): string {
  return crypto.randomBytes(9).toString('base64url');
}

export class Room {
  readonly code: string;
  hostId = '';
  phase: 'lobby' | 'playing' | 'finished' = 'lobby';
  settings: Settings = { perceval: true, mordred: false, oberon: false, lady: false, talk: 'oral', timer: 0 };
  players: Player[] = [];
  game: Game | null = null;
  final: FinalView | null = null;
  wins = new Map<string, number>();
  minds = new Map<string, Mind>();
  chat: ChatMessage[] = [];
  /** L'état pour lequel les échéances ont été posées. */
  armedSeq = -1;
  stageStartedAt = 0;
  /** Date limite de l'étape pour un joueur présent (Infinity : sans limite). */
  stageEndsAt = Infinity;
  due = new Map<string, number>();
  lastActive = Date.now();
  onChange: () => void = () => {};
  onEmote: (playerId: string, text: string) => void = () => {};

  private chatSeq = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(code: string) {
    this.code = code;
  }

  // ───────────────────────────── Membres ─────────────────────────────

  get(id: string | undefined): Player | undefined {
    return id ? this.players.find((p) => p.id === id) : undefined;
  }

  findByToken(playerId: unknown, token: unknown): Player | undefined {
    if (typeof playerId !== 'string' || typeof token !== 'string') return undefined;
    const p = this.get(playerId);
    return p && !p.isBot && p.token === token ? p : undefined;
  }

  get seated(): Player[] {
    return this.players.filter((p) => p.status !== 'spectator');
  }

  get humansOnline(): number {
    return this.players.filter((p) => !p.isBot && p.connected).length;
  }

  touch(): void {
    this.lastActive = Date.now();
  }

  private uniqueName(name: string): string {
    const taken = new Set(this.players.map((p) => p.name.toLowerCase()));
    if (!taken.has(name.toLowerCase())) return name;
    for (let i = 2; i < 99; i++) {
      const candidate = `${name.slice(0, 13)} ${i}`;
      if (!taken.has(candidate.toLowerCase())) return candidate;
    }
    return name;
  }

  private makePlayer(name: string, avatar: string, isBot: boolean, status: PlayerStatus): Player {
    return {
      id: uid(),
      token: uid() + uid(),
      name: this.uniqueName(name),
      avatar,
      isBot,
      sockets: new Set(),
      connected: isBot,
      disconnectedAt: Date.now(),
      left: false,
      status,
    };
  }

  addHuman(name: string, avatar: string): Player | string {
    if (this.players.length >= MAX_MEMBERS) return 'Cette table est pleine.';
    if (this.phase === 'lobby' && this.seated.length >= MAX_PLAYERS) return `La table est complète (${MAX_PLAYERS} joueurs maximum).`;
    const p = this.makePlayer(name, avatar, false, this.phase === 'lobby' ? 'lobby' : 'spectator');
    this.players.push(p);
    if (!this.hostId) this.hostId = p.id;
    return p;
  }

  addBot(by: string): string | undefined {
    if (by !== this.hostId) return "Seul l'hôte peut ajouter des bots.";
    if (this.phase !== 'lobby') return 'On ajoute des bots dans le salon.';
    if (this.seated.length >= MAX_PLAYERS) return `La table est complète (${MAX_PLAYERS} joueurs maximum).`;
    const used = new Set(this.players.map((p) => p.name));
    const name = BOT_NAMES.find((n) => !used.has(n)) ?? `Chevalier ${this.players.length + 1}`;
    const usedAvatars = new Set(this.players.map((p) => p.avatar));
    const free = AVATARS.filter((a) => !usedAvatars.has(a));
    const pool = free.length ? free : AVATARS;
    this.players.push(this.makePlayer(name, pool[crypto.randomInt(pool.length)], true, 'lobby'));
    return undefined;
  }

  kick(by: string, target: string): { sockets: string[] } | string {
    if (by !== this.hostId) return "Seul l'hôte peut retirer un joueur.";
    if (this.phase !== 'lobby') return 'On ne peut retirer un joueur que dans le salon.';
    const p = this.get(target);
    if (!p || p.id === by) return 'Joueur introuvable.';
    this.players = this.players.filter((x) => x.id !== p.id);
    return { sockets: [...p.sockets] };
  }

  leave(id: string): void {
    const p = this.get(id);
    if (!p) return;
    p.sockets.clear();
    p.connected = false;
    p.disconnectedAt = Date.now();
    // En partie, son siège reste à la table : le pilote automatique le tient.
    if (this.phase === 'lobby' || p.status === 'spectator') this.players = this.players.filter((x) => x.id !== id);
    else p.left = true;
    if (this.hostId === id) this.transferHost();
  }

  private transferHost(): void {
    const next = this.players.find((p) => !p.isBot && !p.left && p.connected) ?? this.players.find((p) => !p.isBot && !p.left);
    this.hostId = next?.id ?? '';
  }

  connect(p: Player, socketId: string): void {
    p.sockets.add(socketId);
    p.connected = true;
    p.left = false;
    if (!this.hostId || !this.get(this.hostId) || this.get(this.hostId)?.left) this.hostId = p.id;
  }

  disconnect(id: string | undefined, socketId: string): void {
    const p = this.get(id);
    if (!p) return;
    p.sockets.delete(socketId);
    if (p.sockets.size === 0) {
      p.connected = false;
      p.disconnectedAt = Date.now();
    }
  }

  isAuto(p: Player): boolean {
    return p.isBot || p.left || (!p.connected && Date.now() - p.disconnectedAt >= GRACE_MS);
  }

  updateSettings(by: string, payload: Record<string, unknown>): string | undefined {
    if (by !== this.hostId) return "Seul l'hôte peut changer les réglages.";
    if (this.phase !== 'lobby') return 'Les réglages se changent dans le salon.';
    for (const key of ['perceval', 'mordred', 'oberon', 'lady'] as const) if (typeof payload[key] === 'boolean') this.settings[key] = payload[key] as boolean;
    if (payload.talk === 'oral' || payload.talk === 'ecrit') this.settings.talk = payload.talk;
    if ((TIMER_OPTIONS as readonly unknown[]).includes(payload.timer)) this.settings.timer = payload.timer as Timer;
    return undefined;
  }

  // ───────────────────────────── Partie ─────────────────────────────

  start(by: string): string | undefined {
    if (by !== this.hostId) return "Seul l'hôte peut lancer la partie.";
    if (this.phase !== 'lobby') return 'La partie est déjà lancée.';
    const seated = this.seated;
    if (seated.length < MIN_PLAYERS) return `Il faut au moins ${MIN_PLAYERS} joueurs (ajoute des bots si besoin).`;
    if (seated.length > MAX_PLAYERS) return `${MAX_PLAYERS} joueurs au plus.`;
    const problem = rolesProblem(this.settings, seated.length);
    if (problem) return problem;
    for (const p of seated) p.status = 'playing';
    const order = shuffle(seated.map((p) => p.id));
    const spectators = this.players.filter((p) => p.status === 'spectator');
    this.players = [...order.map((id) => this.get(id)!), ...spectators];
    const g = new Game(order, this.settings, { eventMs: EVENT_MS });
    this.game = g;
    this.minds.clear();
    for (const id of order) {
      const p = this.get(id)!;
      this.minds.set(id, new Mind(id, g.role(id), order, g.sees(id), EVIL_COUNT[order.length], p.isBot ? randomSkill() : PILOT_SKILL, { rememberVotes: p.isBot }));
    }
    this.chat = [];
    this.phase = 'playing';
    this.final = null;
    this.armedSeq = -1;
    return undefined;
  }

  restart(by: string): string | undefined {
    if (by !== this.hostId) return "Seul l'hôte peut relancer une partie.";
    if (this.phase === 'lobby') return undefined;
    this.clearTimer();
    this.players = this.players.filter((p) => !p.left);
    let seats = 0;
    for (const p of this.players) {
      p.status = seats < MAX_PLAYERS ? 'lobby' : 'spectator';
      if (p.status === 'lobby') seats++;
    }
    this.phase = 'lobby';
    this.game = null;
    this.final = null;
    this.minds.clear();
    this.chat = [];
    return undefined;
  }

  endEarly(by: string): string | undefined {
    if (by !== this.hostId) return "Seul l'hôte peut arrêter la partie.";
    if (this.phase !== 'playing') return undefined;
    return this.restart(by);
  }

  private check(seq?: unknown): Game | string {
    if (this.phase !== 'playing' || !this.game) return "Aucune partie n'est en cours.";
    if (seq !== undefined && seq !== this.game.seq) return 'La partie a avancé entre-temps.';
    return this.game;
  }

  private act(fn: (g: Game) => string | undefined, seq?: unknown): string | undefined {
    const g = this.check(seq);
    return typeof g === 'string' ? g : fn(g);
  }

  ready(by: string): string | undefined {
    return this.act((g) => g.markReady(by));
  }

  toggle(by: string, target: unknown, seq?: unknown): string | undefined {
    return this.act((g) => g.toggle(by, target), seq);
  }

  propose(by: string, seq?: unknown): string | undefined {
    return this.act((g) => g.propose(by), seq);
  }

  vote(by: string, approve: unknown, seq?: unknown): string | undefined {
    return this.act((g) => g.vote(by, approve), seq);
  }

  play(by: string, card: unknown, seq?: unknown): string | undefined {
    return this.act((g) => g.play(by, card), seq);
  }

  examine(by: string, target: unknown, seq?: unknown): string | undefined {
    return this.act((g) => {
      const err = g.examine(by, target);
      if (!err) this.minds.get(by)?.observeLady(target as string, g.side(target as string));
      return err;
    }, seq);
  }

  assassinate(by: string, target: unknown, seq?: unknown): string | undefined {
    return this.act((g) => g.assassinate(by, target), seq);
  }

  /** Messagerie de table, en mode écrit : les joueurs assis débattent, les spectateurs lisent. */
  say(by: string, raw: unknown): string | undefined {
    if (this.phase !== 'playing' || !this.game) return "La discussion s'ouvre pendant la partie.";
    if (this.settings.talk !== 'ecrit') return 'Cette table débat à voix haute.';
    if (!this.game.order.includes(by)) return 'Les spectateurs lisent sans écrire.';
    const text = typeof raw === 'string' ? raw.replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 160) : '';
    if (!text) return undefined;
    this.chat = [...this.chat, { id: ++this.chatSeq, by, text }].slice(-CHAT_KEEP);
    return undefined;
  }

  /** Plus aucun humain présent à la table : les bots jouent vite. */
  private onlyBots(): boolean {
    return this.players.every((p) => p.status !== 'playing' || this.isAuto(p));
  }

  private botDelay(min: number, spread: number): number {
    if (FAST) return 15;
    if (this.onlyBots()) return 200;
    return min + Math.random() * spread;
  }

  /** Une nouvelle étape : les bots se donnent un temps de réflexion, les présents un éventuel chrono. */
  private armStage(): void {
    const g = this.game!;
    const now = Date.now();
    this.armedSeq = g.seq;
    this.stageStartedAt = now;
    this.due.clear();
    const timer = this.settings.timer * 1000;
    const quick = FAST ? 900 : timer ? QUICK_MS : Infinity;
    const slow = FAST ? 900 : timer || Infinity;
    const delays: Record<string, [number, number]> = {
      night: [1500, 2500],
      team: [3500, 3500],
      vote: [1200, 2800],
      quest: [1200, 2300],
      lady: [3000, 2000],
      assassin: [5000, 4000],
    };
    switch (g.stage) {
      case 'night':
        this.stageEndsAt = now + NIGHT_MS;
        break;
      case 'team':
      case 'assassin':
        this.stageEndsAt = now + slow;
        break;
      case 'vote':
      case 'quest':
      case 'lady':
        this.stageEndsAt = now + quick;
        break;
      case 'votes':
        this.stageEndsAt = now + VOTES_MS;
        break;
      case 'reveal':
        this.stageEndsAt = now + REVEAL_BASE_MS + (g.reveal?.length ?? 0) * REVEAL_CARD_MS + REVEAL_TAIL_MS;
        break;
      case 'over':
        this.stageEndsAt = now + WIN_MS;
        break;
    }
    const d = delays[g.stage];
    if (d) for (const id of g.waiting()) this.due.set(id, now + this.botDelay(d[0], d[1]));
  }

  /** Les votes dévoilés et les cartes retournées entrent dans la mémoire de chacun. */
  private settleVotes(): void {
    const g = this.game!;
    if (g.lastVote) for (const m of this.minds.values()) m.observeVote(g.lastVote);
    g.afterVotes();
  }

  private settleQuest(): void {
    const g = this.game!;
    if (g.lastQuest) {
      for (const m of this.minds.values()) m.observeQuest(g.lastQuest);
      this.botReacts(g.lastQuest.result === 'fail');
    }
    g.afterReveal();
  }

  /** De temps en temps, un bot réagit à une quête : la même réaction, quel que soit son camp. */
  private botReacts(failed: boolean): void {
    if (FAST || this.onlyBots()) return;
    const bots = this.players.filter((p) => p.isBot && p.status === 'playing');
    if (!bots.length || Math.random() > 0.35) return;
    const bot = bots[crypto.randomInt(bots.length)];
    const pool = failed ? ['😱', '👀', 'Menteur !', '🤔'] : ['🙏', 'Bien joué', '😇'];
    setTimeout(() => this.onEmote(bot.id, pool[crypto.randomInt(pool.length)]), 1400);
  }

  private finishGame(): void {
    const g = this.game;
    if (!g?.victory) return;
    const winners = new Set(g.winners());
    for (const id of winners) this.wins.set(id, (this.wins.get(id) ?? 0) + 1);
    this.final = {
      victory: { ...g.victory },
      quests: g.quests.map((q) => ({ ...q })),
      target: g.victory.target ?? null,
      players: g.order.map((id) => {
        const p = this.get(id);
        return {
          id,
          name: p?.name ?? '?',
          avatar: p?.avatar ?? AVATARS[0],
          role: g.role(id),
          side: g.side(id),
          wins: this.wins.get(id) ?? 0,
          winner: winners.has(id),
        };
      }),
    };
    this.phase = 'finished';
    this.clearTimer();
  }

  // ───────────────────────────── Minuteries & pilote automatique ─────────────────────────────

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  /** À appeler après chaque changement : planifie la prochaine échéance puis diffuse l'état. */
  commit(): void {
    if (this.phase === 'playing' && this.game && this.game.seq !== this.armedSeq) this.armStage();
    this.reschedule();
    this.onChange();
  }

  /** Quand agir pour un joueur : bot → délai naturel, absent → fin du délai de grâce, sinon fin du chrono. */
  private dueAt(id: string): number {
    const p = this.get(id);
    const botAt = this.due.get(id) ?? Date.now();
    if (!p) return Date.now();
    if (p.isBot) return botAt;
    if (this.isAuto(p)) return Math.min(botAt, Math.max(this.stageStartedAt + 1200, p.disconnectedAt + (p.left ? 0 : GRACE_MS)));
    if (!p.connected) return Math.min(this.stageEndsAt, p.disconnectedAt + GRACE_MS);
    return this.stageEndsAt;
  }

  private nextDue(): number {
    const g = this.game!;
    if (g.stage === 'votes' || g.stage === 'reveal' || g.stage === 'over') return this.stageEndsAt;
    let due = g.stage === 'night' ? this.stageEndsAt : Infinity;
    for (const id of g.waiting()) due = Math.min(due, this.dueAt(id));
    return due;
  }

  private reschedule(): void {
    this.clearTimer();
    const g = this.game;
    if (this.phase !== 'playing' || !g) return;
    const now = Date.now();
    let due = this.nextDue();
    // Un événement affiché doit disparaître des écrans à l'heure dite.
    for (const e of g.events) if (e.until > now) due = Math.min(due, e.until + 5);
    if (!Number.isFinite(due)) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      try {
        this.tick();
      } catch (e) {
        console.error(`[room ${this.code}]`, e);
      }
      this.commit();
    }, Math.max(0, Math.min(due - now, 2_147_000_000)));
  }

  tick(): void {
    const g = this.game;
    if (this.phase !== 'playing' || !g) return;
    const now = Date.now();
    switch (g.stage) {
      case 'over':
        if (now >= this.stageEndsAt) this.finishGame();
        return;
      case 'votes':
        if (now >= this.stageEndsAt) this.settleVotes();
        return;
      case 'reveal':
        if (now >= this.stageEndsAt) this.settleQuest();
        return;
      case 'night':
        for (const id of g.waiting()) if (now >= this.stageEndsAt || now >= this.dueAt(id)) g.markReady(id);
        return;
    }
    const seq = g.seq;
    for (const id of g.waiting()) {
      if (g.seq !== seq) break;
      if (now >= this.dueAt(id)) this.autoPlay(id);
    }
  }

  /** Le bot agit ; le pilote automatique d'un absent fait de même, avec ce que son rôle lui montre. */
  autoPlay(id: string): void {
    const g = this.game!;
    const p = this.get(id)!;
    const mind = this.minds.get(id) ?? new Mind(id, g.role(id), g.order, g.sees(id), EVIL_COUNT[g.n], PILOT_SKILL, { rememberVotes: false });
    let err: string | undefined;
    switch (g.stage) {
      case 'team':
        err = g.setTeam(id, botTeam(g, mind)) ?? g.propose(id);
        break;
      case 'vote':
        err = g.vote(id, p.isBot || this.isAuto(p) ? botVote(g, mind) : true);
        break;
      case 'quest':
        err = g.play(id, botCard(g, mind));
        break;
      case 'lady': {
        const target = botLady(g, mind);
        err = this.examine(id, target);
        break;
      }
      case 'assassin':
        err = g.assassinate(id, botAssassin(g, mind));
        break;
    }
    if (!err) return;
    // Filet de sécurité : la partie ne doit jamais se bloquer.
    console.error(`[room ${this.code}] action refusée (${g.stage})`, err);
    if (g.stage === 'team') g.setTeam(id, g.order.slice(0, g.size)) ?? g.propose(id);
    else if (g.stage === 'vote') g.vote(id, true);
    else if (g.stage === 'quest') g.play(id, 'success');
    else if (g.stage === 'lady') this.examine(id, g.ladyTargets()[0]);
    else if (g.stage === 'assassin') g.assassinate(id, g.order.find((o) => o !== id));
  }

  dispose(): void {
    this.clearTimer();
  }

  // ───────────────────────────── Vue personnalisée ─────────────────────────────

  private gameView(g: Game, viewer: string): GameView {
    const now = Date.now();
    const seated = g.order.includes(viewer);
    const showTeam = g.stage !== 'night' && g.stage !== 'lady' && g.stage !== 'assassin';
    const done = g.stage === 'night' ? [...g.ready] : g.stage === 'vote' ? [...g.votes.keys()] : g.stage === 'quest' ? [...g.cards.keys()] : [];
    const endsAt = ['team', 'vote', 'quest', 'lady', 'assassin', 'night'].includes(g.stage) && Number.isFinite(this.stageEndsAt) && (this.settings.timer > 0 || g.stage === 'night' || FAST) ? this.stageEndsAt : 0;
    return {
      order: [...g.order],
      stage: g.stage,
      seq: g.seq,
      quest: g.quest,
      quests: g.quests.map((q) => ({ ...q })),
      rejects: g.rejects,
      leaderId: g.leader,
      team: showTeam ? [...g.team] : [],
      done,
      votes: g.stage === 'votes' && g.lastVote ? { ...g.lastVote.votes } : null,
      approved: g.stage === 'votes' && g.lastVote ? g.lastVote.approved : null,
      myVote: g.stage === 'vote' ? (g.votes.get(viewer) ?? null) : null,
      myCard: g.stage === 'quest' ? (g.cards.get(viewer) ?? null) : null,
      reveal: g.stage === 'reveal' && g.reveal ? [...g.reveal] : null,
      ladyId: g.ladyId,
      ladyUsed: [...g.ladyUsed],
      assassinId: g.stage === 'assassin' || g.stage === 'over' ? g.assassinId : null,
      endsAt,
      me: seated ? { role: g.role(viewer), side: g.side(viewer), sees: g.sees(viewer), ladyNotes: [...(g.ladyNotes.get(viewer) ?? [])] } : null,
      victory: g.victory ? { ...g.victory } : null,
      events: g.events.filter((e) => e.until > now).map((e) => ({ ...e })),
      chat: this.settings.talk === 'ecrit' ? this.chat.map((m) => ({ ...m })) : [],
    };
  }

  viewFor(viewerId: string): RoomView {
    const g = this.phase === 'playing' ? this.game : null;
    return {
      code: this.code,
      phase: this.phase,
      me: viewerId,
      hostId: this.hostId,
      settings: { ...this.settings },
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        isBot: p.isBot,
        isHost: p.id === this.hostId,
        connected: p.isBot || p.connected,
        autopilot: !p.isBot && p.status === 'playing' && this.isAuto(p),
        status: p.status,
        wins: this.wins.get(p.id) ?? 0,
      })),
      game: g ? this.gameView(g, viewerId) : null,
      final: this.final,
      serverNow: Date.now(),
    };
  }
}
