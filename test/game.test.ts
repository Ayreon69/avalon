import { describe, expect, it } from 'vitest';
import { EVIL_COUNT, QUEST_SIZES, SIDE, rolesProblem, type Role, type Settings } from '../shared/protocol';
import { Mind, botCard, botTeam, botVote, randomSkill } from '../server/bots';
import { Game, dealRoles } from '../server/game';
import { Room } from '../server/room';

const BASE: Settings = { perceval: true, mordred: false, oberon: false, lady: false, talk: 'oral', timer: 0 };
const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);

/** Une partie à rôles imposés : p0 mène la première équipe. */
function game(roles: Role[], settings: Partial<Settings> = {}): Game {
  const g = new Game(ids(roles.length), { ...BASE, ...settings }, { roles, leader: 0, eventMs: 0 });
  for (const id of g.order) g.markReady(id);
  return g;
}

function propose(g: Game, team: string[]): void {
  expect(g.setTeam(g.leader, team)).toBeUndefined();
  expect(g.propose(g.leader)).toBeUndefined();
}

function voteAll(g: Game, approve: boolean | ((id: string) => boolean)): void {
  for (const id of g.order) g.vote(id, typeof approve === 'function' ? approve(id) : approve);
}

/** Une quête complète : l'équipe part, chacun joue la carte donnée (Réussite par défaut). */
function quest(g: Game, team: string[], fails: string[] = []): void {
  propose(g, team);
  voteAll(g, true);
  g.afterVotes();
  for (const id of team) expect(g.play(id, fails.includes(id) ? 'fail' : 'success')).toBeUndefined();
  g.afterReveal();
}

const FIVE: Role[] = ['merlin', 'perceval', 'servant', 'assassin', 'morgane'];

describe('distribution', () => {
  it('respecte le livret : camps et rôles de 5 à 10 joueurs', () => {
    for (let n = 5; n <= 10; n++) {
      const roles = dealRoles(n, { perceval: true, mordred: n >= 7, oberon: n === 10 });
      expect(roles.filter((r) => SIDE[r] === 'evil')).toHaveLength(EVIL_COUNT[n]);
      expect(roles.filter((r) => r === 'merlin')).toHaveLength(1);
      expect(roles.filter((r) => r === 'assassin')).toHaveLength(1);
      expect(roles.includes('perceval') && roles.includes('morgane')).toBe(true);
      expect(roles.includes('mordred')).toBe(n >= 7);
      expect(roles.includes('oberon')).toBe(n === 10);
    }
  });

  it('refuse plus de rôles du Mal que de places', () => {
    expect(rolesProblem({ ...BASE, mordred: true }, 5)).toContain('2 places');
    expect(rolesProblem({ ...BASE, mordred: true, oberon: true }, 10)).toBeNull();
    expect(rolesProblem({ ...BASE, mordred: true, oberon: true }, 9)).not.toBeNull();
  });

  it('donne la taille de chaque quête et le double échec de la 4e dès 7 joueurs', () => {
    const g7 = game(['merlin', 'servant', 'servant', 'servant', 'assassin', 'minion', 'minion']);
    expect(g7.quests.map((q) => q.size)).toEqual(QUEST_SIZES[7]);
    expect(g7.quests.map((q) => q.needed)).toEqual([1, 1, 1, 2, 1]);
    expect(game(FIVE).quests.every((q) => q.needed === 1)).toBe(true);
  });
});

describe('la nuit', () => {
  it('montre à chacun ce que son rôle permet de voir', () => {
    const roles: Role[] = ['merlin', 'perceval', 'servant', 'servant', 'servant', 'servant', 'assassin', 'morgane', 'mordred', 'oberon'];
    const g = new Game(ids(10), { ...BASE, mordred: true, oberon: true }, { roles, leader: 0 });
    const seen = (id: string) => g.sees(id).map((s) => s.id).sort();
    // Merlin voit tout le Mal sauf Mordred, Oberon compris.
    expect(seen('p0')).toEqual(['p6', 'p7', 'p9']);
    // Perceval voit Merlin et Morgane, sans savoir qui est qui.
    expect(seen('p1')).toEqual(['p0', 'p7']);
    expect(g.sees('p1').every((s) => s.as === 'merlin-or-morgane')).toBe(true);
    expect(seen('p2')).toEqual([]);
    // Les sbires se connaissent, sauf Oberon.
    expect(seen('p6')).toEqual(['p7', 'p8']);
    expect(seen('p8')).toEqual(['p6', 'p7']);
    expect(seen('p9')).toEqual([]);
  });

  it('attend que tout le monde ait vu son rôle', () => {
    const g = new Game(ids(5), BASE, { roles: FIVE, leader: 2 });
    for (const id of ids(4)) g.markReady(id);
    expect(g.stage).toBe('night');
    g.markReady('p4');
    expect(g.stage).toBe('team');
    expect(g.leader).toBe('p2');
  });
});

describe('équipes et votes', () => {
  it('le meneur seul forme une équipe de la bonne taille', () => {
    const g = game(FIVE);
    expect(g.toggle('p1', 'p1')).toBeTruthy();
    expect(g.toggle('p0', 'p0')).toBeUndefined();
    expect(g.propose('p0')).toContain('2 chevaliers');
    g.toggle('p0', 'p3');
    expect(g.toggle('p0', 'p4')).toContain('retires-en');
    g.toggle('p0', 'p3');
    expect(g.team).toEqual(['p0']);
  });

  it('une égalité rejette ; cinq rejets d’affilée font gagner le Mal', () => {
    const roles: Role[] = ['merlin', 'perceval', 'servant', 'servant', 'assassin', 'morgane'];
    const g = game(roles);
    propose(g, ['p0', 'p1']);
    voteAll(g, (id) => ['p0', 'p1', 'p2'].includes(id));
    expect(g.stage).toBe('votes');
    expect(g.lastVote?.approved).toBe(false);
    g.afterVotes();
    expect(g.rejects).toBe(1);
    expect(g.leader).toBe('p1');
    for (let i = 0; i < 4; i++) {
      propose(g, [g.leader, g.order[(g.leaderIdx + 1) % 6]]);
      voteAll(g, false);
      g.afterVotes();
    }
    expect(g.victory).toEqual({ side: 'evil', reason: 'rejects' });
  });

  it('un vote approuvé remet le compteur de rejets à zéro', () => {
    const g = game(FIVE);
    propose(g, ['p0', 'p1']);
    voteAll(g, false);
    g.afterVotes();
    propose(g, ['p1', 'p2']);
    voteAll(g, true);
    g.afterVotes();
    expect(g.rejects).toBe(0);
    expect(g.stage).toBe('quest');
  });

  it('on peut changer son vote tant que tout le monde n’a pas voté', () => {
    const g = game(FIVE);
    propose(g, ['p0', 'p1']);
    g.vote('p2', false);
    g.vote('p2', true);
    expect(g.votes.get('p2')).toBe(true);
    expect(g.stage).toBe('vote');
  });
});

describe('quêtes', () => {
  it('un loyal ne peut pas saboter, les cartes sont mélangées', () => {
    const g = game(FIVE);
    propose(g, ['p0', 'p3']);
    voteAll(g, true);
    g.afterVotes();
    expect(g.play('p0', 'fail')).toContain('Réussite');
    expect(g.play('p2', 'success')).toContain("pas partie");
    g.play('p3', 'fail');
    g.play('p0', 'success');
    expect(g.stage).toBe('reveal');
    expect([...g.reveal!].sort()).toEqual(['fail', 'success']);
    expect(g.lastQuest).toMatchObject({ fails: 1, result: 'fail' });
    g.afterReveal();
    expect(g.quests[0].result).toBe('fail');
    expect(g.quest).toBe(1);
  });

  it('à 7, la 4e quête résiste à un seul Échec', () => {
    const g = game(['merlin', 'servant', 'servant', 'servant', 'assassin', 'minion', 'minion']);
    quest(g, ['p0', 'p1']);
    quest(g, ['p0', 'p1', 'p2'], []);
    quest(g, ['p4', 'p1', 'p2'], ['p4']);
    expect(g.quest).toBe(3);
    quest(g, ['p4', 'p1', 'p2', 'p3'], ['p4']);
    expect(g.quests[3].result).toBe('success');
  });

  it('trois échecs font gagner le Mal', () => {
    const g = game(FIVE);
    quest(g, ['p0', 'p3'], ['p3']);
    quest(g, ['p0', 'p1', 'p3'], ['p3']);
    quest(g, ['p0', 'p4'], ['p4']);
    expect(g.victory).toEqual({ side: 'evil', reason: 'fails' });
  });

  it('trois réussites ouvrent l’assassinat : Merlin tué, le Mal gagne', () => {
    const g = game(FIVE);
    quest(g, ['p0', 'p1']);
    quest(g, ['p0', 'p1', 'p2']);
    quest(g, ['p0', 'p1']);
    expect(g.stage).toBe('assassin');
    expect(g.assassinate('p4', 'p0')).toContain('Assassin');
    g.assassinate('p3', 'p0');
    expect(g.victory).toEqual({ side: 'evil', reason: 'assassinated', target: 'p0' });
    expect(g.winners().sort()).toEqual(['p3', 'p4']);
  });

  it('l’Assassin se trompe : le Bien gagne', () => {
    const g = game(FIVE);
    quest(g, ['p0', 'p1']);
    quest(g, ['p0', 'p1', 'p2']);
    quest(g, ['p0', 'p1']);
    g.assassinate('p3', 'p1');
    expect(g.victory).toEqual({ side: 'good', reason: 'missed', target: 'p1' });
  });
});

describe('la Dame du Lac', () => {
  it('commence à droite du premier meneur et sert après les quêtes 2, 3 et 4', () => {
    const roles: Role[] = ['merlin', 'perceval', 'servant', 'servant', 'assassin', 'morgane', 'minion'];
    const g = game(roles, { lady: true });
    expect(g.ladyId).toBe('p6');
    quest(g, ['p0', 'p1']);
    expect(g.stage).toBe('team');
    quest(g, ['p1', 'p2', 'p3']);
    expect(g.stage).toBe('lady');
    expect(g.examine('p0', 'p1')).toBeTruthy();
    expect(g.examine('p6', 'p4')).toBeUndefined();
    expect(g.ladyNotes.get('p6')).toEqual([{ target: 'p4', side: 'evil' }]);
    expect(g.ladyId).toBe('p4');
    expect(g.stage).toBe('team');
    quest(g, ['p0', 'p4', 'p1'], ['p4']);
    expect(g.stage).toBe('lady');
    // Celui qui l'a déjà tenue ne peut plus être sondé.
    expect(g.ladyTargets()).not.toContain('p6');
    expect(g.examine('p4', 'p6')).toBeTruthy();
  });
});

describe('table et vues', () => {
  function room(bots = 5): { r: Room; host: string } {
    const r = new Room('ABCD');
    const host = r.addHuman('Léa', 'lion');
    if (typeof host === 'string') throw new Error(host);
    r.hostId = host.id;
    for (let i = 0; i < bots - 1; i++) r.addBot(host.id);
    return { r, host: host.id };
  }

  it('ne dévoile ni les rôles des autres, ni les votes avant la fin, ni qui a joué quoi', () => {
    const { r, host } = room(6);
    expect(r.start(host)).toBeUndefined();
    const g = r.game!;
    for (const id of g.order) g.markReady(id);
    const v = r.viewFor(host);
    const text = JSON.stringify(v);
    expect(v.game!.me!.role).toBe(g.role(host));
    // Aucun autre rôle n'apparaît dans la vue, hormis ce que mon rôle me montre.
    for (const id of g.order) if (g.role(id) !== g.role(host)) expect(text).not.toContain(`"role":"${g.role(id)}","side"`);
    g.setTeam(g.leader, g.order.slice(0, 2));
    g.propose(g.leader);
    g.vote(g.order[1], false);
    const during = r.viewFor(host).game!;
    expect(during.votes).toBeNull();
    expect(during.done).toEqual([g.order[1]]);
  });

  it('refuse de lancer avec trop de rôles du Mal', () => {
    const { r, host } = room(5);
    r.updateSettings(host, { mordred: true });
    expect(r.start(host)).toContain('Mordred');
  });

  it('les spectateurs ne voient aucun rôle', () => {
    const { r, host } = room(5);
    r.start(host);
    const spec = r.addHuman('Zino', 'cerf');
    if (typeof spec === 'string') throw new Error(spec);
    expect(r.viewFor(spec.id).game!.me).toBeNull();
  });
});

describe('bots', () => {
  it('Merlin sait qui sert Mordred ; un loyal déduit le traître d’une quête ratée à deux', () => {
    const g = game(FIVE);
    const merlin = new Mind('p0', 'merlin', g.order, g.sees('p0'), 2, randomSkill());
    expect(merlin.pEvil('p3')).toBe(1);
    expect(merlin.pEvil('p2')).toBe(0);
    const servant = new Mind('p2', 'servant', g.order, [], 2, { forget: 0, noise: 0, bluff: 0 });
    servant.observeQuest({ quest: 0, team: ['p2', 'p4'], fails: 1, result: 'fail' });
    expect(servant.pEvil('p4')).toBe(1);
    expect(servant.pClean(['p2', 'p4'])).toBe(0);
  });

  it('un loyal joue toujours Réussite, un sbire forme une équipe avec lui-même', () => {
    const g = game(FIVE);
    const servant = new Mind('p2', 'servant', g.order, [], 2, randomSkill());
    const assassin = new Mind('p3', 'assassin', g.order, g.sees('p3'), 2, randomSkill());
    propose(g, ['p0', 'p2']);
    voteAll(g, true);
    g.afterVotes();
    expect(botCard(g, servant)).toBe('success');
    g.play('p0', 'success');
    g.play('p2', 'success');
    g.afterReveal();
    // Le meneur suivant est p1 ; on fait comme si c'était l'Assassin pour vérifier sa composition.
    expect(botTeam(Object.assign(Object.create(Object.getPrototypeOf(g)), g, { leaderIdx: 3 }) as Game, assassin)).toContain('p3');
  });

  it('à la dernière chance, un loyal approuve', () => {
    const g = game(FIVE);
    for (let i = 0; i < 4; i++) {
      propose(g, [g.leader, g.order[(g.leaderIdx + 1) % 5]]);
      voteAll(g, false);
      g.afterVotes();
    }
    propose(g, [g.leader, g.order[(g.leaderIdx + 1) % 5]]);
    const servant = new Mind('p2', 'servant', g.order, [], 2, randomSkill());
    expect(g.rejects).toBe(4);
    expect(botVote(g, servant)).toBe(true);
  });
});
