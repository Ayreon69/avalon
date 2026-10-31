// Simulation : des bots entre eux, pour juger leur niveau et la durée des parties (npx tsx test/sim.ts 300).
import { EVIL_COUNT, type Settings } from '../shared/protocol';
import { Mind, botAssassin, botCard, botLady, botTeam, botVote, randomSkill } from '../server/bots';
import { Game } from '../server/game';

const N = Number(process.argv[2] ?? 300);

const BASE: Settings = { perceval: true, mordred: false, oberon: false, lady: false, talk: 'oral', timer: 0 };

interface Outcome {
  good: boolean;
  reason: string;
  proposals: number;
}

function play(n: number, settings: Settings, naive: { good: boolean; evil: boolean }): Outcome {
  const order = Array.from({ length: n }, (_, i) => `p${i}`);
  const g = new Game(order, settings, { eventMs: 0 });
  const minds = new Map(
    order.map((id) => {
      const role = g.role(id);
      const side = g.side(id);
      return [id, new Mind(id, role, order, g.sees(id), EVIL_COUNT[n], randomSkill(), { naive: naive[side] })];
    }),
  );
  for (const id of order) g.markReady(id);
  for (let guard = 0; g.stage !== 'over' && guard < 500; guard++) {
    if (g.stage === 'team') {
      g.setTeam(g.leader, botTeam(g, minds.get(g.leader)!));
      g.propose(g.leader);
    } else if (g.stage === 'vote') {
      for (const id of order) g.vote(id, botVote(g, minds.get(id)!));
    } else if (g.stage === 'votes') {
      for (const m of minds.values()) m.observeVote(g.lastVote!);
      g.afterVotes();
    } else if (g.stage === 'quest') {
      for (const id of [...g.team]) g.play(id, botCard(g, minds.get(id)!));
    } else if (g.stage === 'reveal') {
      for (const m of minds.values()) m.observeQuest(g.lastQuest!);
      g.afterReveal();
    } else if (g.stage === 'lady') {
      const holder = g.ladyId!;
      const target = botLady(g, minds.get(holder)!);
      g.examine(holder, target);
      minds.get(holder)!.observeLady(target, g.side(target));
    } else if (g.stage === 'assassin') {
      const a = g.assassinId!;
      g.assassinate(a, botAssassin(g, minds.get(a)!));
    }
  }
  return { good: g.victory?.side === 'good', reason: g.victory?.reason ?? 'blocked', proposals: g.proposals };
}

function report(label: string, n: number, settings: Settings, naive: { good: boolean; evil: boolean }): void {
  const reasons = new Map<string, number>();
  let good = 0;
  let proposals = 0;
  for (let i = 0; i < N; i++) {
    const o = play(n, settings, naive);
    if (o.good) good++;
    proposals += o.proposals;
    reasons.set(o.reason, (reasons.get(o.reason) ?? 0) + 1);
  }
  const pct = (x: number) => `${Math.round((x / N) * 100)} %`;
  const detail = [...reasons].map(([r, c]) => `${r} ${pct(c)}`).join(', ');
  console.log(`${label.padEnd(44)} à ${String(n).padStart(2)} : le Bien gagne ${pct(good).padStart(5)}  (${detail}) · ${(proposals / N).toFixed(1)} équipes proposées`);
}

for (const n of [5, 7, 10]) {
  report('Bots qui raisonnent des deux côtés', n, BASE, { good: false, evil: false });
  report('Loyaux qui raisonnent, sbires au hasard', n, BASE, { good: false, evil: true });
  report('Loyaux au hasard, sbires qui raisonnent', n, BASE, { good: true, evil: false });
  report('Au hasard des deux côtés', n, BASE, { good: true, evil: true });
}
report('Tous les rôles et la Dame du Lac', 10, { ...BASE, mordred: true, oberon: true, lady: true }, { good: false, evil: false });
report('Mordred et la Dame du Lac', 7, { ...BASE, mordred: true, lady: true }, { good: false, evil: false });
