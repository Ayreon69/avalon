// Les bots : ils ne savent que ce que leur rôle leur montre, plus ce que toute la table a vu (votes, quêtes).
// Chacun pèse toutes les répartitions possibles des sbires de Mordred selon ces indices, avec un peu d'oubli.
import { SIDE, type Card, type Role, type Seen, type Side } from '../shared/protocol';
import type { Game, QuestResult, VoteResult } from './game';

export interface Skill {
  /** Probabilité d'oublier un vote. */
  forget: number;
  /** Part de hasard dans les choix. */
  noise: number;
  /** Envie de jouer Réussite à la première quête pour gagner la confiance de la table (sbires). */
  bluff: number;
}

export function randomSkill(): Skill {
  const t = Math.random();
  return { forget: 0.03 + 0.12 * (1 - t), noise: 0.05 + 0.25 * (1 - t), bluff: 0.1 + 0.25 * Math.random() };
}

export interface MindOptions {
  /** Le pilote automatique d'un absent ne retient pas les votes : il ne sait que son rôle et le plateau. */
  rememberVotes?: boolean;
  /** Référence pour mesurer les bots : choix au hasard. */
  naive?: boolean;
}

const rand = Math.random;

function pick<T>(list: T[]): T {
  return list[Math.floor(rand() * list.length)];
}

function combos(pool: string[], k: number, start = 0, acc: string[] = [], out: string[][] = []): string[][] {
  if (acc.length === k) {
    out.push([...acc]);
    return out;
  }
  for (let i = start; i <= pool.length - (k - acc.length); i++) {
    acc.push(pool[i]);
    combos(pool, k, i + 1, acc, out);
    acc.pop();
  }
  return out;
}

function choose(n: number, k: number): number {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

/** Chance qu'une équipe comptant k sbires rende f cartes Échec. */
function questLikelihood(k: number, f: number): number {
  if (k === 0) return f === 0 ? 1 : 0;
  if (f > k) return 0;
  const q = 0.8;
  return choose(k, f) * q ** f * (1 - q) ** (k - f);
}

interface Weighted {
  evil: Set<string>;
  w: number;
}

export class Mind {
  readonly side: Side;
  readonly knownEvil = new Set<string>();
  readonly knownGood = new Set<string>();
  /** Perceval : deux joueurs dont un seul est du côté du Mal (Merlin et Morgane). */
  readonly pairs: string[][] = [];
  readonly quests: QuestResult[] = [];
  readonly votes: VoteResult[] = [];
  readonly facts = new Map<string, Side>();
  /**
   * Ce qu'un loyal sans pouvoir penserait à ma place. Merlin s'en sert pour ne pas se trahir,
   * et un sbire pour voter comme un loyal quand l'équipe ne compte aucun complice.
   */
  readonly shadow: Mind | null;
  private cache: Weighted[] | null = null;

  constructor(
    readonly me: string,
    readonly role: Role,
    readonly order: string[],
    sees: Seen[],
    readonly evilTotal: number,
    readonly skill: Skill,
    readonly opts: MindOptions = {},
  ) {
    this.side = SIDE[role];
    (this.side === 'good' ? this.knownGood : this.knownEvil).add(me);
    for (const s of sees) if (s.as === 'evil') this.knownEvil.add(s.id);
    if (role === 'perceval') {
      const ids = sees.map((s) => s.id);
      if (sees[0]?.as === 'merlin-or-morgane' && ids.length === 2) this.pairs.push(ids);
      else for (const id of ids) this.knownGood.add(id);
    }
    this.shadow = role === 'merlin' || this.side === 'evil' ? new Mind(me, 'servant', order, [], evilTotal, skill, opts) : null;
  }

  get naive(): boolean {
    return !!this.opts.naive;
  }

  observeVote(v: VoteResult): void {
    this.shadow?.observeVote(v);
    if (this.opts.rememberVotes === false || rand() < this.skill.forget) return;
    this.votes.push(v);
    this.cache = null;
  }

  observeQuest(q: QuestResult): void {
    this.shadow?.observeQuest(q);
    this.quests.push(q);
    this.cache = null;
  }

  observeLady(target: string, side: Side): void {
    this.facts.set(target, side);
    this.cache = null;
  }

  /** Toutes les répartitions des sbires compatibles avec ce que je sais, pondérées par les indices. */
  private weighted(): Weighted[] {
    if (this.cache) return this.cache;
    const pool = this.order.filter((id) => !this.knownEvil.has(id) && !this.knownGood.has(id) && !this.facts.has(id));
    const factEvil = [...this.facts].filter(([, s]) => s === 'evil').map(([id]) => id);
    const fixed = new Set([...this.knownEvil, ...factEvil]);
    const need = this.evilTotal - fixed.size;
    const sets = need < 0 || need > pool.length ? [] : combos(pool, need);
    const out: { evil: Set<string>; log: number }[] = [];
    for (const extra of sets) {
      const evil = new Set([...fixed, ...extra]);
      if (this.pairs.some((pair) => pair.filter((id) => evil.has(id)).length !== 1)) continue;
      let log = 0;
      for (const q of this.quests) {
        const k = q.team.filter((id) => evil.has(id)).length;
        const l = questLikelihood(k, q.fails);
        if (l === 0) {
          log = -Infinity;
          break;
        }
        log += Math.log(l);
      }
      if (log === -Infinity) continue;
      for (const v of this.votes) {
        // À la dernière chance, tout le monde vote sous la contrainte : le vote dit peu.
        if (v.rejects >= 4) continue;
        const dirty = v.team.some((id) => evil.has(id));
        for (const [voter, yes] of Object.entries(v.votes)) {
          if (voter === this.me) continue;
          const p = evil.has(voter) ? (dirty ? 0.8 : 0.35) : v.team.includes(voter) ? 0.75 : 0.5;
          log += Math.log(yes ? p : 1 - p);
        }
      }
      out.push({ evil, log });
    }
    const max = Math.max(...out.map((o) => o.log));
    this.cache = out.map((o) => ({ evil: o.evil, w: Math.exp(o.log - max) }));
    return this.cache;
  }

  /** Probabilité, à mes yeux, que ce joueur serve Mordred. */
  pEvil(id: string): number {
    if (this.knownEvil.has(id)) return 1;
    if (this.knownGood.has(id)) return 0;
    const sets = this.weighted();
    const total = sets.reduce((s, x) => s + x.w, 0);
    if (!total) return this.evilTotal / this.order.length;
    return sets.reduce((s, x) => s + (x.evil.has(id) ? x.w : 0), 0) / total;
  }

  /** Probabilité, à mes yeux, qu'une équipe ne compte aucun sbire. */
  pClean(team: string[]): number {
    if (team.some((id) => this.knownEvil.has(id))) return 0;
    const sets = this.weighted();
    const total = sets.reduce((s, x) => s + x.w, 0);
    if (!total) return 0.5;
    return sets.reduce((s, x) => s + (team.some((id) => x.evil.has(id)) ? 0 : x.w), 0) / total;
  }

  /** Sbires que je connais dans une équipe (moi compris). */
  knownIn(team: string[]): number {
    return team.filter((id) => this.knownEvil.has(id)).length;
  }
}

/** Le soupçon qui guide un loyal ; Merlin mêle son savoir à ce qu'un loyal ordinaire penserait, pour rester discret. */
function suspicion(m: Mind, id: string): number {
  const own = m.pEvil(id);
  const s = m.side === 'evil' && m.shadow ? m.shadow.pEvil(id) : m.shadow ? 0.6 * own + 0.4 * m.shadow.pEvil(id) : own;
  return s + (rand() - 0.5) * m.skill.noise;
}

function bestTeam(g: Game, m: Mind, size = g.size): string[] {
  const others = g.order.filter((id) => id !== m.me).sort((a, b) => suspicion(m, a) - suspicion(m, b));
  return [m.me, ...others].slice(0, size);
}

/** Le meneur compose son équipe. */
export function botTeam(g: Game, m: Mind): string[] {
  const others = g.order.filter((id) => id !== m.me);
  if (m.naive) return [m.me, ...shuffleCopy(others)].slice(0, g.size);
  if (m.side === 'good') return bestTeam(g, m);
  // Un sbire se met dans l'équipe, avec des joueurs qui ont l'air loyaux ; un complice seulement s'il faut deux Échec.
  const needed = g.quests[g.quest].needed;
  const mates = others.filter((id) => m.knownEvil.has(id));
  const clean = others.filter((id) => !m.knownEvil.has(id)).sort((a, b) => suspicion(m, a) - suspicion(m, b));
  const withMate = needed >= 2 || (g.size >= 4 && rand() < 0.25);
  const team = [m.me, ...(withMate && mates.length ? [pick(mates)] : []), ...clean];
  return team.slice(0, g.size);
}

/** Pour ou contre l'équipe proposée. */
export function botVote(g: Game, m: Mind): boolean {
  if (g.leader === m.me) return true;
  if (m.naive) return rand() < 0.6;
  const team = g.team;
  if (m.side === 'good') {
    if (g.rejects >= 4) return true;
    if (m.role === 'merlin') {
      const clean = m.knownIn(team) === 0;
      // Merlin rejette les équipes douteuses, mais pas toujours : trop de flair le trahirait.
      return rand() < 0.18 ? !clean : clean;
    }
    return loyalVote(g, m, team);
  }
  const known = m.knownIn(team);
  const needed = g.quests[g.quest].needed;
  if (g.rejects >= 4) return known >= needed || rand() < 0.3;
  if (known >= needed) return rand() < 0.92;
  // Sans complice dans l'équipe, il vote comme un loyal l'aurait fait, pour ne pas se faire remarquer.
  return m.shadow ? loyalVote(g, m.shadow, team) : rand() < 0.3;
}

/** Le vote d'un loyal : pour, si l'équipe paraît presque aussi sûre que la meilleure qu'il formerait. */
function loyalVote(g: Game, m: Mind, team: string[]): boolean {
  const pc = m.pClean(team);
  const best = m.pClean(bestTeam(g, m));
  const approve = pc >= best * 0.72 - 0.02;
  return rand() < m.skill.noise * 0.4 ? !approve : approve;
}

/** La carte jouée en quête. */
export function botCard(g: Game, m: Mind): Card {
  if (m.side === 'good') return 'success';
  if (m.naive) return 'fail';
  const needed = g.quests[g.quest].needed;
  if (needed >= 2 || g.count('fail') >= 2 || g.count('success') >= 2) return 'fail';
  // Deux sbires qui se connaissent dans l'équipe : un seul sabote, le premier dans l'ordre de la table.
  const mates = g.team.filter((id) => id !== m.me && m.knownEvil.has(id));
  if (mates.length && m.role !== 'oberon') {
    const first = [m.me, ...mates].sort((a, b) => g.order.indexOf(a) - g.order.indexOf(b))[0];
    if (first !== m.me) return 'success';
  }
  if (g.quest === 0 && rand() < m.skill.bluff) return 'success';
  return 'fail';
}

/** La Dame du Lac : sonder le joueur sur qui l'on hésite le plus. */
export function botLady(g: Game, m: Mind): string {
  const targets = g.ladyTargets();
  if (m.naive || m.side === 'evil') {
    const unknown = targets.filter((id) => !m.knownEvil.has(id));
    return pick(unknown.length ? unknown : targets);
  }
  return [...targets].sort((a, b) => Math.abs(m.pEvil(a) - 0.5) - Math.abs(m.pEvil(b) - 0.5) + (rand() - 0.5) * m.skill.noise)[0];
}

/**
 * L'Assassin cherche Merlin : celui qui a rejeté les équipes où se cachaient des sbires,
 * approuvé les équipes propres et composé des équipes sans eux.
 */
export function botAssassin(g: Game, m: Mind): string {
  const candidates = g.order.filter((id) => id !== m.me && !m.knownEvil.has(id));
  if (m.naive || !candidates.length) return pick(candidates.length ? candidates : g.order.filter((id) => id !== m.me));
  const score = new Map(candidates.map((id) => [id, 0]));
  for (const v of m.votes) {
    const dirty = m.knownIn(v.team) > 0;
    for (const id of candidates) {
      const yes = v.votes[id];
      score.set(id, score.get(id)! + (dirty ? (yes ? -1 : 1) : yes ? 0.3 : -0.2));
    }
    if (score.has(v.leader)) score.set(v.leader, score.get(v.leader)! + (dirty ? -1 : 1.5));
  }
  const norm = Math.max(1, m.votes.length);
  return [...candidates].sort((a, b) => score.get(b)! / norm - score.get(a)! / norm + (rand() - 0.5) * m.skill.noise * 2)[0];
}

function shuffleCopy<T>(list: T[]): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
