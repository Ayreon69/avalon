// Test de bout en bout sur le serveur compilé : de vrais clients socket.io jouent deux parties complètes d'Avalon.
// Partie 1 : 3 humains + 4 bots, mode écrit, Mordred et la Dame du Lac ; une spectatrice arrive, un joueur se déconnecte puis
// revient, une session volée est refusée. Partie 2 : revanche à 10 avec tous les rôles, dont un humain qui ne fait rien
// (le pilote automatique joue pour lui). À chaque état reçu, on vérifie qu'aucun secret ne fuit.
// Usage : npm run build && npm run e2e
import { spawn } from 'node:child_process';
import { io } from 'socket.io-client';

const PORT = 3900 + Math.floor(Math.random() * 90);
const URL = `http://localhost:${PORT}`;
const server = spawn(process.execPath, ['dist/server/index.mjs'], {
  env: { ...process.env, PORT: String(PORT), AV_FAST: '1' },
  stdio: ['ignore', 'pipe', 'inherit'],
});
const fail = (msg) => {
  console.error(`✗ ${msg}`);
  server.kill();
  process.exit(1);
};
setTimeout(() => fail('délai dépassé (3 min)'), 180_000).unref();

await new Promise((resolve) => server.stdout.on('data', (d) => String(d).includes('prêt') && resolve()));

const EVIL_COUNT = { 5: 2, 6: 2, 7: 3, 8: 3, 9: 3, 10: 4 };
const QUEST_SIZES = { 5: [2, 3, 2, 3, 3], 6: [2, 3, 4, 3, 4], 7: [2, 3, 3, 4, 4], 8: [3, 4, 4, 5, 5], 9: [3, 4, 4, 5, 5], 10: [3, 4, 4, 5, 5] };
const EVIL = new Set(['assassin', 'morgane', 'mordred', 'oberon', 'minion']);
const stats = { states: 0, votes: 0, cards: 0, ladies: 0, kills: 0, refused: 0, rounds: new Set(), reveals: new Set() };
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function client(name, { player = true, avatar = 'lion' } = {}) {
  const socket = io(URL, { transports: ['websocket'], forceNew: true });
  const c = { name, socket, view: null, avatar, player, idle: false, session: null, examined: [], role: null, sees: null, notes: [] };
  socket.on('state', (v) => {
    const prev = c.view;
    c.view = v;
    audit(c, v, prev);
    if (c.player && !c.idle) play(c);
  });
  c.call = (event, payload = {}) => new Promise((res) => socket.emit(event, payload, res));
  return c;
}

/** Ce que reçoit chaque client : son rôle seulement, les votes le temps de les retourner, les cartes sans leurs auteurs. */
function audit(c, v, prev) {
  stats.states++;
  const json = JSON.stringify(v);
  for (const word of ['"token"', '"roles"', '"cards"', '"proposals"', '"lastVote"', '"knownEvil"', '"shadow"', '"minds"']) if (json.includes(word)) fail(`${c.name} : la vue contient ${word}`);
  if (v.phase !== 'finished' && v.final) fail('la fin de partie circule avant la fin');
  const g = v.game;
  if (v.phase !== 'playing' || !g) return;
  if ((json.match(/"role":/g) ?? []).length > 1) fail(`${c.name} : le rôle d'un autre joueur circule`);
  const n = g.order.length;
  const seated = g.order.includes(v.me);
  const q = g.quests[g.quest];
  if (!seated && (g.me || g.myVote !== null || g.myCard !== null)) fail(`${c.name} : un spectateur reçoit des secrets`);
  if (seated) {
    if (!g.me) fail(`${c.name} : un joueur assis ne connaît pas son rôle`);
    if (c.role && c.role !== g.me.role) fail(`${c.name} : son rôle a changé en cours de partie`);
    c.role = g.me.role;
    c.sees = g.me.sees;
    c.notes = g.me.ladyNotes;
    // Un joueur inactif laisse le pilote automatique sonder à sa place : le résultat lui revient.
    if (!c.idle && !c.wasAway) for (const note of g.me.ladyNotes) if (!c.examined.includes(note.target)) fail(`${c.name} : un résultat de la Dame du Lac qu'il n'a pas demandé`);
    if (g.me.sees.some((s) => s.id === v.me || !g.order.includes(s.id))) fail(`${c.name} : il se voit lui-même ou voit un absent`);
  }
  if (q.size !== QUEST_SIZES[n][g.quest]) fail(`taille de quête fausse (${q.size})`);
  if ((g.votes !== null) !== (g.stage === 'votes')) fail(`votes visibles à l'étape ${g.stage}`);
  if (g.votes) {
    const ids = Object.keys(g.votes);
    if (ids.length !== n || !g.order.every((id) => ids.includes(id))) fail('votes incomplets au dépouillement');
    const yes = ids.filter((id) => g.votes[id]).length;
    if (g.approved !== yes * 2 > n) fail(`résultat du vote faux (${yes}/${n})`);
    stats.rounds.add(`${g.order[0]}:${g.seq}`);
  }
  if (g.myVote !== null && g.stage !== 'vote') fail('vote personnel visible hors vote');
  if (g.myCard !== null && g.stage !== 'quest') fail('carte personnelle visible hors quête');
  if ((g.reveal !== null) !== (g.stage === 'reveal')) fail(`cartes de quête visibles à l'étape ${g.stage}`);
  if (g.reveal) {
    if (g.reveal.length !== q.size || g.reveal.some((x) => x !== 'success' && x !== 'fail')) fail('cartes de quête invalides');
    stats.reveals.add(`${g.order[0]}:${g.quest}:${g.reveal.filter((x) => x === 'fail').length}`);
  }
  // Après le dévoilement, le résultat de la quête suit les cartes.
  const pg = prev?.game;
  if (pg?.stage === 'reveal' && g.stage !== 'reveal' && pg.reveal && pg.order.join() === g.order.join()) {
    const fails = pg.reveal.filter((x) => x === 'fail').length;
    const want = fails >= pg.quests[pg.quest].needed ? 'fail' : 'success';
    if (g.quests[pg.quest].result !== want) fail(`quête ${pg.quest + 1} : ${fails} Échec mais résultat ${g.quests[pg.quest].result}`);
  }
  if (g.stage === 'night' && g.team.length) fail("l'équipe est visible la nuit");
  if (g.stage === 'vote' && g.team.length !== q.size) fail(`équipe de ${g.team.length} au vote pour une quête de ${q.size}`);
  if (g.stage === 'quest' && g.done.some((id) => !g.team.includes(id))) fail("quelqu'un hors de l'équipe a joué une carte");
  if (g.done.some((id) => !g.order.includes(id))) fail('un absent figure parmi ceux qui ont agi');
  if (g.assassinId && g.stage !== 'assassin' && g.stage !== 'over') fail("l'Assassin est dévoilé trop tôt");
  if (g.victory && g.stage !== 'over') fail('victoire annoncée avant la fin');
  if (g.events.length > 3) fail('trop d’événements : on dirait un historique');
  for (const e of g.events) if (e.until < v.serverNow - 50) fail('un événement expiré circule encore');
  if (v.settings.talk === 'oral' && g.chat.length) fail('une discussion écrite circule à une table orale');
}

const busy = new Set();
const once = (key) => (busy.has(key) ? false : (busy.add(key), true));

/** Un joueur moyen : il compose une équipe au hasard, approuve le plus souvent, joue selon son camp. */
function play(c) {
  const v = c.view;
  const g = v?.game;
  if (!v || v.phase !== 'playing' || !g || !g.order.includes(v.me) || !g.me) return;
  const me = v.me;
  const send = (key, event, payload) => {
    if (!once(`${c.name}:${key}`)) return;
    c.socket.emit(event, payload, (res) => {
      if (!res?.ok) stats.refused++;
    });
  };
  const q = g.quests[g.quest];
  if (g.stage === 'night' && !g.done.includes(me)) return send(`ready:${g.seq}`, 'game:ready', {});
  if (g.stage === 'team' && g.leaderId === me) {
    if (g.team.length < q.size) {
      const free = g.order.filter((id) => !g.team.includes(id));
      const target = free.includes(me) && Math.random() < 0.6 ? me : pick(free);
      return send(`toggle:${g.seq}:${g.team.length}`, 'game:toggle', { playerId: target, seq: g.seq });
    }
    return send(`propose:${g.seq}`, 'game:propose', { seq: g.seq });
  }
  if (g.stage === 'vote' && g.myVote === null) {
    stats.votes++;
    return send(`vote:${g.seq}`, 'game:vote', { approve: Math.random() < 0.75, seq: g.seq });
  }
  if (g.stage === 'quest' && g.team.includes(me) && g.myCard === null) {
    stats.cards++;
    const card = g.me.side === 'good' || Math.random() < 0.5 ? 'success' : 'fail';
    return send(`card:${g.seq}`, 'game:play', { card, seq: g.seq });
  }
  if (g.stage === 'lady' && g.ladyId === me) {
    const target = pick(g.order.filter((id) => id !== me && !g.ladyUsed.includes(id)));
    if (once(`${c.name}:lady:${g.seq}:mark`)) c.examined.push(target);
    stats.ladies++;
    return send(`lady:${g.seq}`, 'game:lady', { target, seq: g.seq });
  }
  if (g.stage === 'assassin' && g.assassinId === me) {
    stats.kills++;
    return send(`kill:${g.seq}`, 'game:assassinate', { target: pick(g.order.filter((id) => id !== me)), seq: g.seq });
  }
}

const waitFor = (c, test, label, ms = 60_000) =>
  new Promise((resolve) => {
    const t0 = Date.now();
    const check = setInterval(() => {
      if (test(c.view)) {
        clearInterval(check);
        resolve();
      } else if (Date.now() - t0 > ms) fail(`attente trop longue : ${label}`);
    }, 20);
  });

/** La fin de partie : la bonne distribution des rôles, une victoire justifiée, et ce que chacun a vu était exact. */
function checkFinal(final, settings, humans) {
  const n = final.players.length;
  const roles = final.players.map((p) => p.role);
  const count = (r) => roles.filter((x) => x === r).length;
  const roleOf = (id) => final.players.find((p) => p.id === id).role;
  if (roles.filter((r) => EVIL.has(r)).length !== EVIL_COUNT[n]) fail(`${n} joueurs : mauvais nombre de sbires`);
  if (count('merlin') !== 1 || count('assassin') !== 1) fail('il faut un Merlin et un Assassin');
  if (count('perceval') !== +settings.perceval || count('morgane') !== +settings.perceval) fail('Perceval et Morgane mal distribués');
  if (count('mordred') !== +settings.mordred || count('oberon') !== +settings.oberon) fail('Mordred ou Oberon mal distribués');
  for (const p of final.players) if (p.side !== (EVIL.has(p.role) ? 'evil' : 'good')) fail(`${p.name} : camp faux`);
  const v = final.victory;
  const won = final.quests.filter((x) => x.result === 'success').length;
  const lost = final.quests.filter((x) => x.result === 'fail').length;
  if (v.reason === 'fails' && (lost !== 3 || v.side !== 'evil')) fail('victoire par les échecs injustifiée');
  if ((v.reason === 'missed' || v.reason === 'assassinated') && won !== 3) fail("assassinat sans trois quêtes réussies");
  if (v.reason === 'assassinated' && (roleOf(final.target) !== 'merlin' || v.side !== 'evil')) fail("l'Assassin a gagné sans tuer Merlin");
  if (v.reason === 'missed' && (roleOf(final.target) === 'merlin' || v.side !== 'good')) fail("Merlin assassiné, et pourtant le Bien gagne");
  if (v.reason === 'rejects' && v.side !== 'evil') fail('cinq rejets sans victoire du Mal');
  for (const p of final.players) if (p.winner !== (p.side === v.side)) fail(`${p.name} : gagnant mal marqué`);
  // Ce que la nuit a montré à chacun.
  for (const c of humans) {
    const me = c.view.me;
    const role = roleOf(me);
    if (role !== c.role) fail(`${c.name} : le rôle dévoilé n'est pas celui joué`);
    const expected = final.players
      .filter((p) => p.id !== me)
      .flatMap((p) => {
        if (role === 'merlin') return EVIL.has(p.role) && p.role !== 'mordred' ? [`${p.id}:evil`] : [];
        if (role === 'perceval') return p.role === 'merlin' || p.role === 'morgane' ? [`${p.id}:merlin-or-morgane`] : [];
        if (EVIL.has(role) && role !== 'oberon') return EVIL.has(p.role) && p.role !== 'oberon' ? [`${p.id}:evil`] : [];
        return [];
      })
      .sort();
    const seen = c.sees.map((s) => `${s.id}:${s.as}`).sort();
    if (expected.join() !== seen.join()) fail(`${c.name} (${role}) a vu ${seen.join(' ') || 'personne'} au lieu de ${expected.join(' ') || 'personne'}`);
    for (const note of c.notes) if (note.side !== (EVIL.has(roleOf(note.target)) ? 'evil' : 'good')) fail(`${c.name} : la Dame du Lac a menti`);
  }
  return v;
}

// ── Partie 1 : 3 humains + 4 bots, mode écrit, Mordred et la Dame du Lac ──
const host = client('Ana');
await new Promise((r) => host.socket.on('connect', r));
const created = await host.call('room:create', { name: 'Ana', avatar: 'lion', bots: 4 });
if (!created.ok) fail(`création : ${created.error}`);
const code = created.data.code;
const bob = client('Bob', { avatar: 'loup' });
const chloe = client('Chloé', { avatar: 'cygne' });
await Promise.all([bob, chloe].map((c) => new Promise((r) => c.socket.on('connect', r))));
for (const c of [bob, chloe]) {
  const res = await c.call('room:join', { code, name: c.name, avatar: c.avatar });
  if (!res.ok) fail(`arrivée de ${c.name} : ${res.error}`);
  c.session = res.data;
}
if ((await bob.call('room:settings', { lady: true })).ok) fail('un invité a changé les réglages');
if (!(await host.call('room:settings', { mordred: true, oberon: true, lady: true, talk: 'ecrit' })).ok) fail('réglages refusés');
if ((await host.call('game:start')).ok) fail('une partie à 7 avec quatre sbires spéciaux a été lancée');
await host.call('room:settings', { oberon: false });
if ((await bob.call('game:start')).ok) fail('un invité a lancé la partie');
const settings1 = { ...host.view.settings };
const start = await host.call('game:start');
if (!start.ok) fail(`lancement : ${start.error}`);
if ((await host.call('room:settings', { lady: false })).ok) fail('les réglages ont changé en pleine partie');

// Une spectatrice arrive en cours de partie : elle lit la discussion, sans rôle ni droit d'écrire.
await sleep(150);
const watcher = client('Dora', { player: false, avatar: 'licorne' });
await new Promise((r) => watcher.socket.on('connect', r));
const joined = await watcher.call('room:join', { code, name: 'Dora', avatar: 'licorne' });
if (!joined.ok) fail(`spectatrice : ${joined.error}`);
watcher.session = joined.data;
await sleep(80);
if (watcher.view.players.find((p) => p.name === 'Dora')?.status !== 'spectator') fail('la retardataire devrait regarder');
if ((await watcher.call('chat:say', { text: 'Je peux parler ?' })).ok) fail('une spectatrice a écrit dans la discussion');
if (!(await bob.call('chat:say', { text: '  Je   me méfie <b>de</b> Ana  ' })).ok) fail('message refusé');
await sleep(80);
const said = watcher.view.game?.chat.at(-1);
if (said?.text !== 'Je me méfie bde/b Ana' || said.by !== bob.session.playerId) fail(`message mal nettoyé ou mal attribué : ${said?.text}`);

// Un vote envoyé pour un état passé est refusé.
await waitFor(host, (v) => v?.game?.stage === 'vote' || v?.phase === 'finished', 'un vote');
if (host.view.phase === 'playing' && (await host.call('game:vote', { approve: true, seq: host.view.game.seq - 1 })).ok) fail('un vote périmé a été accepté');
// Un loyal ne peut pas jouer Échec, et un joueur hors de l'équipe ne joue pas.
await waitFor(host, (v) => v?.game?.stage === 'quest' || v?.phase === 'finished', 'une quête');
if (host.view.phase === 'playing') {
  const g = host.view.game;
  const out = [host, bob, chloe].find((c) => !g.team.includes(c.view.me));
  if (out && (await out.call('game:play', { card: 'success', seq: out.view.game.seq })).ok) fail("un joueur hors de l'équipe a joué une carte");
}

// Bob se déconnecte un moment, puis revient avec sa session ; une session volée est refusée.
// Pendant son absence, le pilote peut jouer pour lui (et même sonder avec la Dame du Lac).
bob.wasAway = true;
bob.socket.disconnect();
await sleep(500);
bob.socket.connect();
await new Promise((r) => bob.socket.on('connect', r));
const back = await bob.call('room:join', { code, playerId: bob.session.playerId, token: bob.session.token, resumeOnly: true });
if (!back.ok) fail(`retour de Bob : ${back.error}`);
const intruder = await chloe.call('room:join', { code, playerId: bob.session.playerId, token: 'faux', resumeOnly: true });
if (intruder.ok) fail('une session volée a été acceptée');
const ghost = await watcher.call('room:join', { code: 'ZZZZ', playerId: 'x', token: 'y', resumeOnly: true });
if (ghost.ok) fail('une table inexistante a répondu');

await waitFor(host, (v) => v?.phase === 'finished', 'fin de la partie 1', 120_000);
const v1 = checkFinal(host.view.final, settings1, [host, bob, chloe]);
for (const c of [host, bob, chloe]) if (c.view.final?.victory.reason !== v1.reason) fail(`${c.name} n'a pas reçu la même fin`);
if (!host.view.players.some((p) => p.wins === 1)) fail('la victoire n’est pas comptée');
const quests1 = host.view.final.quests.map((x) => (x.result === 'success' ? 'R' : x.result === 'fail' ? 'É' : '·')).join('');

// ── Partie 2 : revanche à 10, tous les rôles, mode oral ; Dora s'assoit et ne fait rien ──
if ((await bob.call('game:restart')).ok) fail('un invité a relancé la partie');
if (!(await host.call('game:restart')).ok) fail('revanche refusée');
await sleep(100);
if (host.view.phase !== 'lobby') fail('la revanche ne ramène pas au salon');
if (host.view.players.find((p) => p.name === 'Dora')?.status !== 'lobby') fail('la spectatrice ne s’assoit pas pour la revanche');
// Nouvelle partie : les numéros d'état repartent de zéro.
busy.clear();
for (const c of [host, bob, chloe]) Object.assign(c, { role: null, sees: null, notes: [], examined: [], wasAway: false });
watcher.player = true;
watcher.idle = true;
for (let i = 0; i < 2; i++) if (!(await host.call('room:addBot')).ok) fail('ajout de bot refusé');
if (!(await host.call('room:settings', { perceval: true, mordred: true, oberon: true, lady: true, talk: 'oral', timer: 120 })).ok) fail('réglages refusés');
const seatedNow = host.view.players.filter((p) => p.status !== 'spectator').length;
if (seatedNow !== 10) fail(`10 joueurs attendus au salon, ${seatedNow} trouvés`);
if ((await host.call('room:addBot')).ok) fail('un onzième joueur a été ajouté');
const settings2 = { ...host.view.settings };
if (!(await host.call('game:start')).ok) fail('lancement de la revanche refusé');
await sleep(50);
if ((await bob.call('chat:say', { text: 'coucou' })).ok) fail('on écrit à une table orale');
await waitFor(host, (v) => v?.phase === 'finished', 'fin de la partie 2', 150_000);
// Le pilote automatique a joué pour Dora : elle est bien allée au bout.
watcher.role = host.view.final.players.find((p) => p.id === watcher.view.me).role;
const v2 = checkFinal(host.view.final, settings2, [host, bob, chloe, watcher]);
const quests2 = host.view.final.quests.map((x) => (x.result === 'success' ? 'R' : x.result === 'fail' ? 'É' : '·')).join('');

const reason = { fails: 'trois quêtes échouées', rejects: 'cinq équipes rejetées', assassinated: 'Merlin assassiné', missed: "l'Assassin a manqué Merlin" };
console.log(`✓ partie 1 (7 joueurs, écrit, Mordred, Dame du Lac) : quêtes ${quests1}, ${v1.side === 'good' ? 'le Bien' : 'le Mal'} gagne (${reason[v1.reason]}).`);
console.log(`✓ partie 2 (10 joueurs, tous les rôles, pilote pour Dora) : quêtes ${quests2}, ${v2.side === 'good' ? 'le Bien' : 'le Mal'} gagne (${reason[v2.reason]}).`);
console.log(
  `  ${stats.votes} votes, ${stats.cards} cartes de quête, ${stats.ladies} Dame du Lac et ${stats.kills} assassinat joués par les humains ; ${stats.rounds.size} dépouillements et ${stats.reveals.size} dévoilements vérifiés ; ${stats.refused} actions refusées (état passé) ; ${stats.states} états vérifiés sans fuite.`,
);
for (const c of [host, bob, chloe, watcher]) c.socket.close();
server.kill();
process.exit(0);
