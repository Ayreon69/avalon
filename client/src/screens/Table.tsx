// La Table ronde : les chevaliers tout autour, les cinq quêtes au centre, et sous la table ce que chacun peut faire.
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, Check, Eye, LogOut, Menu, MessageCircle, Flag, Send, Smile, Volume2, VolumeX, WifiOff, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { EMOTES, TAUNTS, type Card, type GameView, type PlayerView, type RoomView } from '../../../shared/protocol';
import { Ballot, CrownIcon, LadyIcon, QuestCard, QuestMedal, RoleWindow, ShieldIcon } from '../components/Art';
import { RoleReveal, RoleSheet } from '../components/RoleCard';
import { Avatar, Button, Logo, Modal } from '../components/Ui';
import { sfx } from '../lib/sound';
import { Name, eventText, listing, nameOf, questLabel, victoryText, victoryTitle } from '../lib/text';
import { cls, plural, secondsLeft, useTick, vibrate } from '../lib/util';
import { leaveRoom, send, socket } from '../net';
import { useStore } from '../store';

/** Les cartes se retournent au même rythme que sur le serveur (voir room.ts). */
const REVEAL_BASE_MS = 1_700;
const REVEAL_CARD_MS = 1_150;

type Seat = { p: PlayerView; x: number; y: number; angle: number };

/** Place les chevaliers autour de la table, toi en bas, dans l'ordre de la partie (le sens des aiguilles d'une montre). */
function useSeats(view: RoomView, g: GameView): Seat[] {
  return useMemo(() => {
    const n = g.order.length;
    const mine = Math.max(0, g.order.indexOf(view.me));
    const radius = n >= 9 ? 40.5 : 39.5;
    return g.order.map((id, i) => {
      const angle = 90 + ((i - mine) * 360) / n;
      const rad = (angle * Math.PI) / 180;
      return { p: view.players.find((p) => p.id === id)!, x: 50 + radius * Math.cos(rad), y: 50 + radius * Math.sin(rad), angle };
    });
  }, [view.players, view.me, g.order]);
}

function Timer({ endsAt }: { endsAt: number }) {
  const now = useTick(250);
  if (!endsAt) return null;
  const left = secondsLeft(endsAt, now);
  return <span className={cls('timer', left <= 10 && 'is-low')}>{left >= 60 ? `${Math.floor(left / 60)} min ${String(left % 60).padStart(2, '0')}` : `${left} s`}</span>;
}

function Chips({ view, ids }: { view: RoomView; ids: string[] }) {
  return (
    <ul className="chips">
      {ids.map((id) => {
        const p = view.players.find((x) => x.id === id);
        return (
          <motion.li key={id} className={cls('chip', id === view.me && 'is-me')} layout initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <Avatar avatar={p?.avatar ?? 'lion'} />
            <span>{id === view.me ? 'Toi' : p?.name}</span>
          </motion.li>
        );
      })}
    </ul>
  );
}

/** Les cartes de la quête, mélangées, qui se retournent une à une ; puis le verdict. */
function RevealCards({ cards, needed, seq }: { cards: Card[]; needed: number; seq: number }) {
  const [shown, setShown] = useState(0);
  const [done, setDone] = useState(false);
  useEffect(() => {
    setShown(0);
    setDone(false);
    const timers = cards.map((c, i) =>
      window.setTimeout(() => {
        setShown(i + 1);
        sfx.flip(c === 'fail');
        if (c === 'fail') vibrate(40);
      }, REVEAL_BASE_MS + i * REVEAL_CARD_MS),
    );
    const end = window.setTimeout(() => {
      setDone(true);
      const failed = cards.filter((c) => c === 'fail').length >= needed;
      if (failed) sfx.fail();
      else sfx.success();
      vibrate(failed ? [60, 40, 60] : 30);
    }, REVEAL_BASE_MS + cards.length * REVEAL_CARD_MS + 250);
    return () => [...timers, end].forEach((t) => window.clearTimeout(t));
    // Une nouvelle quête, un nouveau dévoilement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq]);
  const fails = cards.slice(0, shown).filter((c) => c === 'fail').length;
  const failed = cards.filter((c) => c === 'fail').length >= needed;
  return (
    <div className="reveal-cards" role="status" aria-live="polite">
      <div className="reveal-row">
        {cards.map((c, i) => (
          <motion.div
            key={i}
            className="reveal-slot"
            initial={{ y: -60, opacity: 0, rotate: (i - cards.length / 2) * 6 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            transition={{ delay: 0.12 * i, type: 'spring', stiffness: 220, damping: 18 }}
          >
            <div className={cls('flip', i < shown && 'is-up')}>
              <QuestCard card={null} className="flip-back" />
              <QuestCard card={c} className="flip-front" />
            </div>
          </motion.div>
        ))}
      </div>
      <p className="reveal-count">{shown === 0 ? 'Les cartes sont mélangées…' : fails === 0 ? 'Aucun Échec pour l’instant' : plural(fails, 'carte Échec').replace('cartes Échec', 'cartes Échec')}</p>
      <AnimatePresence>
        {done && (
          <motion.div className={cls('stamp', failed ? 'is-fail' : 'is-success')} initial={{ scale: 1.5, opacity: 0, rotate: -14 }} animate={{ scale: 1, opacity: 1, rotate: -6 }} transition={{ type: 'spring', stiffness: 320, damping: 16 }}>
            {failed ? 'Quête échouée' : 'Quête réussie'}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SeatView({
  view,
  g,
  seat,
  pickable,
  picked,
  onPick,
}: {
  view: RoomView;
  g: GameView;
  seat: Seat;
  pickable: boolean;
  picked: boolean;
  onPick: (id: string) => void;
}) {
  const { p } = seat;
  const leader = g.leaderId === p.id && g.stage !== 'night' && g.stage !== 'over';
  const inTeam = g.team.includes(p.id);
  const done = g.done.includes(p.id) && (g.stage === 'vote' || g.stage === 'quest' || g.stage === 'night');
  const waiting = !done && ((g.stage === 'vote' && true) || (g.stage === 'quest' && inTeam));
  const vote = g.votes ? g.votes[p.id] : undefined;
  const assassin = g.assassinId === p.id;
  const lady = g.ladyId === p.id;
  const target = g.victory?.target === p.id;
  const away = !p.isBot && (!p.connected || p.autopilot);
  const style = { left: `${seat.x}%`, top: `${seat.y}%` } as CSSProperties;
  return (
    <button
      type="button"
      className={cls('seat', p.id === view.me && 'is-me', leader && 'is-leader', inTeam && 'is-team', pickable && 'is-pickable', picked && 'is-picked', waiting && 'is-waiting', assassin && 'is-assassin', target && 'is-target', away && 'is-away')}
      style={style}
      disabled={!pickable}
      onClick={() => onPick(p.id)}
      aria-label={`${p.id === view.me ? 'Toi' : p.name}${leader ? ', meneur' : ''}${inTeam ? ', dans l’équipe' : ''}${lady ? ', tient la Dame du Lac' : ''}`}
      data-seat={p.id}
    >
      <span className="seat-medal">
        <Avatar avatar={p.avatar} />
        {leader && <CrownIcon className="seat-crown" />}
        {inTeam && <ShieldIcon className="seat-shield" />}
        {lady && <LadyIcon className="seat-lady" />}
        {done && (
          <span className="seat-done" aria-hidden>
            <Check size={11} strokeWidth={3.5} />
          </span>
        )}
        {away && (
          <span className="seat-away" aria-hidden>
            <WifiOff size={10} strokeWidth={3} />
          </span>
        )}
        <AnimatePresence>
          {vote !== undefined && (
            <motion.span className="seat-ballot" initial={{ rotateY: 90, scale: 0.4 }} animate={{ rotateY: 0, scale: 1 }} exit={{ scale: 0, opacity: 0, transition: { duration: 0.2 } }} transition={{ delay: 0.05 * g.order.indexOf(p.id), duration: 0.3 }}>
              <Ballot yes={vote} />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <span className="seat-name">{p.id === view.me ? 'Toi' : p.name}</span>
      {assassin && <span className="seat-tag is-evil">Assassin</span>}
    </button>
  );
}

function EmoteLayer({ seats }: { seats: Seat[] }) {
  const emotes = useStore((s) => s.emotes);
  return (
    <div className="emote-layer" aria-live="polite">
      <AnimatePresence>
        {emotes.map((e) => {
          const seat = seats.find((s) => s.p.id === e.playerId);
          if (!seat) return null;
          const big = [...e.emoji].length <= 2;
          return (
            <motion.span
              key={e.id}
              className={cls('emote', big ? 'is-emoji' : 'is-text')}
              style={{ left: `${seat.x}%`, top: `${seat.y}%` }}
              initial={{ y: 0, opacity: 0, scale: 0.5 }}
              animate={{ y: -46, opacity: 1, scale: 1 }}
              exit={{ y: -70, opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              {e.emoji}
            </motion.span>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function Reactions({ onClose }: { onClose: () => void }) {
  const say = (emoji: string) => {
    socket.emit('emote', { emoji });
    onClose();
  };
  return (
    <motion.div className="reactions" initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }}>
      <div className="reactions-emoji">
        {EMOTES.map((e) => (
          <button key={e} type="button" onClick={() => say(e)} aria-label={`Réagir ${e}`}>
            {e}
          </button>
        ))}
      </div>
      <div className="reactions-text">
        {TAUNTS.map((t) => (
          <button key={t} type="button" onClick={() => say(t)}>
            {t}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function Chat({ view, g, docked }: { view: RoomView; g: GameView; docked?: boolean }) {
  const open = useStore((s) => s.chatOpen);
  const setOpen = useStore((s) => s.setChatOpen);
  const markSeen = useStore((s) => s.markChatSeen);
  const [text, setText] = useState('');
  const list = useRef<HTMLDivElement>(null);
  const last = g.chat[g.chat.length - 1]?.id ?? 0;
  const visible = docked || open;
  useEffect(() => {
    if (!visible) return;
    markSeen(last);
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' });
  }, [last, visible, markSeen]);
  const seated = g.order.includes(view.me);
  const submit = async () => {
    const t = text.trim();
    if (!t) return;
    if (await send('chat:say', { text: t })) setText('');
  };
  const body = (
    <div className={cls('chat', docked && 'is-docked')}>
      <div className="chat-list" ref={list}>
        {g.chat.length === 0 && <p className="muted small chat-empty">La discussion est ouverte. Accuse, défends-toi, convaincs !</p>}
        {g.chat.map((m) => {
          const p = view.players.find((x) => x.id === m.by);
          return (
            <div key={m.id} className={cls('chat-msg', m.by === view.me && 'is-me')}>
              <Avatar avatar={p?.avatar ?? 'lion'} />
              <div>
                <b>{m.by === view.me ? 'Toi' : p?.name}</b>
                <p>{m.text}</p>
              </div>
            </div>
          );
        })}
      </div>
      {seated ? (
        <form
          className="chat-form"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <input className="input" value={text} maxLength={160} placeholder="Ton message…" onChange={(e) => setText(e.target.value)} aria-label="Message" />
          <button type="submit" className="icon-btn is-solid" aria-label="Envoyer" disabled={!text.trim()}>
            <Send size={18} />
          </button>
        </form>
      ) : (
        <p className="muted small">Les spectateurs lisent sans écrire.</p>
      )}
    </div>
  );
  if (docked) return body;
  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Discussion" className="chat-modal">
      {body}
    </Modal>
  );
}

/** Ce que tu peux faire maintenant, sous la table. */
function ActionPanel({ view, g, aim, setAim }: { view: RoomView; g: GameView; aim: string | null; setAim: (id: string | null) => void }) {
  const me = view.me;
  const seated = g.order.includes(me);
  const leader = g.leaderId;
  const oral = view.settings.talk === 'oral';
  const [shake, setShake] = useState(false);
  const missing = g.order.filter((id) => !g.done.includes(id));
  const q = g.quests[g.quest];

  if (g.stage === 'team') {
    if (leader === me) {
      const full = g.team.length === q.size;
      return (
        <div className="panel-inner">
          <p className="kicker">
            À toi de mener <Timer endsAt={g.endsAt} />
          </p>
          <h2>
            Choisis {q.size} chevaliers pour la {questLabel(g.quest).toLowerCase()} quête
          </h2>
          <p className="hint">Touche les sièges autour de la table, toi compris si tu veux partir.</p>
          <Chips view={view} ids={g.team} />
          <Button variant="primary" className="btn-lg btn-wide" disabled={!full} onClick={() => void send('game:propose', { seq: g.seq })}>
            {full ? 'Proposer cette équipe' : `Encore ${q.size - g.team.length} à choisir`}
          </Button>
        </div>
      );
    }
    return (
      <div className="panel-inner">
        <p className="kicker">
          {questLabel(g.quest)} quête · équipe de {q.size} <Timer endsAt={g.endsAt} />
        </p>
        <h2>{Name(view, leader)} compose l'équipe</h2>
        <Chips view={view} ids={g.team} />
        <p className="hint">{oral ? 'Donne ton avis à voix haute : qui doit partir, qui doit rester ?' : 'Donne ton avis dans la discussion : qui doit partir, qui doit rester ?'}</p>
      </div>
    );
  }

  if (g.stage === 'vote') {
    return (
      <div className="panel-inner">
        <p className="kicker">
          Vote secret <Timer endsAt={g.endsAt} />
        </p>
        <h2>L'équipe proposée par {nameOf(view, leader)} doit-elle partir ?</h2>
        <Chips view={view} ids={g.team} />
        {g.rejects >= 4 && <p className="warn">Dernière chance : si cette équipe est rejetée, le Mal gagne.</p>}
        {seated ? (
          <>
            <div className="vote-buttons">
              <button type="button" className={cls('vote-btn is-yes', g.myVote === true && 'is-on')} onClick={() => void send('game:vote', { approve: true, seq: g.seq }).then((ok) => ok && sfx.vote(true))}>
                <Ballot yes />
                <span>Pour</span>
              </button>
              <button type="button" className={cls('vote-btn is-no', g.myVote === false && 'is-on')} onClick={() => void send('game:vote', { approve: false, seq: g.seq }).then((ok) => ok && sfx.vote(false))}>
                <Ballot yes={false} />
                <span>Contre</span>
              </button>
            </div>
            <p className="hint">{g.myVote === null ? 'Les votes se retournent tous ensemble.' : `Vote posé. Tu peux changer d'avis tant que tout le monde n'a pas voté.`}</p>
          </>
        ) : null}
        {missing.length > 0 && missing.length < g.order.length && <p className="hint">En attente de {listing(missing.map((id) => nameOf(view, id)))}.</p>}
      </div>
    );
  }

  if (g.stage === 'votes' && g.votes) {
    const yes = g.order.filter((id) => g.votes![id]);
    const no = g.order.filter((id) => !g.votes![id]);
    return (
      <div className="panel-inner">
        <p className="kicker">Les votes sont retournés</p>
        <h2 className={g.approved ? 't-good' : 't-evil'}>{g.approved ? 'L’équipe part en quête' : 'L’équipe est rejetée'}</h2>
        <div className="vote-lists">
          <p>
            <Ballot yes /> {yes.length ? listing(yes.map((id) => nameOf(view, id))) : 'personne'}
          </p>
          <p>
            <Ballot yes={false} /> {no.length ? listing(no.map((id) => nameOf(view, id))) : 'personne'}
          </p>
        </div>
        {!g.approved && <p className="hint">Le meneur suivant va proposer son équipe.</p>}
      </div>
    );
  }

  if (g.stage === 'quest') {
    const mine = g.team.includes(me);
    if (mine && !g.myCard) {
      const good = g.me?.side === 'good';
      const play = (card: Card) => {
        if (card === 'fail' && good) {
          setShake(true);
          window.setTimeout(() => setShake(false), 500);
          useStore.getState().showToast('Un loyal serviteur d’Arthur joue toujours Réussite.', 'info');
          return;
        }
        void send('game:play', { card, seq: g.seq });
      };
      return (
        <div className="panel-inner">
          <p className="kicker">
            Tu pars en quête <Timer endsAt={g.endsAt} />
          </p>
          <h2>Joue ta carte, en secret</h2>
          <div className={cls('card-choice', shake && 'is-shake')}>
            <button type="button" className="card-btn is-success" onClick={() => play('success')}>
              <QuestCard card="success" />
              <span>Réussite</span>
            </button>
            <button type="button" className="card-btn is-fail" onClick={() => play('fail')}>
              <QuestCard card="fail" />
              <span>Échec</span>
            </button>
          </div>
          <p className="hint">{q.needed > 1 ? 'Cette quête n’échoue qu’avec deux cartes Échec.' : 'Une seule carte Échec suffit à faire échouer la quête.'}</p>
        </div>
      );
    }
    const left = g.team.filter((id) => !g.done.includes(id));
    return (
      <div className="panel-inner">
        <p className="kicker">La quête est en cours</p>
        <h2>{mine ? 'Ta carte est jouée' : `${listing(g.team.map((id) => nameOf(view, id)))} choisissent leur carte`}</h2>
        <p className="hint">{left.length ? `Encore ${listing(left.map((id) => nameOf(view, id)))}…` : 'Les cartes sont rassemblées…'}</p>
      </div>
    );
  }

  if (g.stage === 'reveal') {
    return (
      <div className="panel-inner">
        <p className="kicker">{questLabel(g.quest)} quête</p>
        <h2>Les cartes sont mélangées, puis retournées</h2>
        <p className="hint">Personne ne saura qui a joué quoi.</p>
      </div>
    );
  }

  if (g.stage === 'lady') {
    const holder = g.ladyId;
    if (holder === me) {
      return (
        <div className="panel-inner">
          <p className="kicker">
            La Dame du Lac <Timer endsAt={g.endsAt} />
          </p>
          <h2>Choisis qui sonder</h2>
          <p className="hint">Tu découvriras son camp, en secret, puis tu lui confieras la Dame du Lac.</p>
          {aim && <Chips view={view} ids={[aim]} />}
          <Button variant="primary" className="btn-lg btn-wide" disabled={!aim} onClick={() => void send('game:lady', { target: aim, seq: g.seq }).then((ok) => ok && setAim(null))}>
            {aim ? `Sonder ${nameOf(view, aim)}` : 'Touche un siège'}
          </Button>
        </div>
      );
    }
    return (
      <div className="panel-inner">
        <p className="kicker">La Dame du Lac</p>
        <h2>{Name(view, holder)} va sonder un joueur</h2>
        <p className="hint">Ce qu'il en dira ensuite, vrai ou faux, n'engage que lui.</p>
      </div>
    );
  }

  if (g.stage === 'assassin') {
    const assassin = g.assassinId;
    if (assassin === me) {
      return (
        <div className="panel-inner is-evil">
          <p className="kicker">
            Dernière chance du Mal <Timer endsAt={g.endsAt} />
          </p>
          <h2>Trouve Merlin, et frappe</h2>
          <p className="hint">{oral ? 'Tes complices peuvent te conseiller à voix haute.' : 'Tes complices peuvent te conseiller dans la discussion.'}</p>
          {aim && <Chips view={view} ids={[aim]} />}
          <Button variant="danger" className="btn-lg btn-wide" disabled={!aim} onClick={() => void send('game:assassinate', { target: aim, seq: g.seq }).then((ok) => ok && setAim(null))}>
            {aim ? `Assassiner ${nameOf(view, aim)}` : 'Touche un siège'}
          </Button>
        </div>
      );
    }
    return (
      <div className="panel-inner is-evil">
        <p className="kicker">Trois quêtes réussies</p>
        <h2>L'Assassin, {nameOf(view, assassin)}, cherche Merlin</h2>
        <p className="hint">{g.me?.side === 'evil' ? 'Aide-le à trouver Merlin !' : g.me?.role === 'merlin' ? 'Reste de marbre…' : 'Protège Merlin : brouille les pistes.'}</p>
      </div>
    );
  }

  if (g.stage === 'over' && g.victory) {
    return (
      <div className="panel-inner">
        <p className="kicker">Fin de la partie</p>
        <h2 className={g.victory.side === 'good' ? 't-good' : 't-evil'}>{victoryTitle(g.victory)}</h2>
        <p className="hint">{victoryText(view, g.victory)}</p>
      </div>
    );
  }

  return null;
}

/** La nuit : chacun découvre son rôle à l'abri des regards. */
function Night({ view, g }: { view: RoomView; g: GameView }) {
  const me = g.me;
  const ready = g.done.includes(view.me);
  const count = g.done.length;
  return (
    <motion.div className="night" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="night-stars" aria-hidden />
      <div className="night-body">
        <p className="kicker">La nuit tombe sur Camelot</p>
        {me ? (
          <>
            <RoleReveal view={view} me={me} />
            {ready ? (
              <p className="waiting" role="status">
                <span className="spinner" /> En attente des autres ({count}/{g.order.length})…
              </p>
            ) : (
              <Button variant="primary" className="btn-lg btn-wide" onClick={() => void send('game:ready')}>
                J'ai vu mon rôle
              </Button>
            )}
            <p className="muted small">Tu pourras le revoir pendant la partie avec le bouton « Mon rôle ».</p>
          </>
        ) : (
          <p className="waiting">Les chevaliers découvrent leur rôle…</p>
        )}
      </div>
    </motion.div>
  );
}

/** Le résultat de la Dame du Lac, pour celui qui l'a consultée. */
function LadyResult({ view, g }: { view: RoomView; g: GameView }) {
  const notes = g.me?.ladyNotes ?? [];
  const seen = useRef(notes.length);
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    if (notes.length > seen.current) {
      setOpen(notes.length - 1);
      sfx.reveal(notes[notes.length - 1].side === 'evil');
    }
    seen.current = notes.length;
  }, [notes]);
  const note = open !== null ? notes[open] : null;
  if (!note) return null;
  return (
    <Modal open onClose={() => setOpen(null)} title="La Dame du Lac">
      <div className="lady-result">
        <RoleWindow role={note.side === 'good' ? 'servant' : 'minion'} />
        <p>
          <b>{nameOf(view, note.target)}</b> {note.side === 'good' ? 'est loyal à Arthur.' : 'sert Mordred.'}
        </p>
        <p className="muted small">Toi seul le sais. À toi de voir ce que tu en dis.</p>
        <Button variant="primary" onClick={() => setOpen(null)} data-autofocus>
          Compris
        </Button>
      </div>
    </Modal>
  );
}

export function Table({ view }: { view: RoomView }) {
  const g = view.game!;
  const seats = useSeats(view, g);
  const prefs = useStore((s) => s.prefs);
  const setPrefs = useStore((s) => s.setPrefs);
  const setRulesOpen = useStore((s) => s.setRulesOpen);
  const setRoleOpen = useStore((s) => s.setRoleOpen);
  const setChatOpen = useStore((s) => s.setChatOpen);
  const chatSeen = useStore((s) => s.chatSeen);
  const [aim, setAim] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [react, setReact] = useState(false);
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 980px)').matches);
  const isHost = view.hostId === view.me;
  const written = view.settings.talk === 'ecrit';
  const unread = g.chat.filter((m) => m.id > chatSeen && m.by !== view.me).length;
  useTick(500);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 980px)');
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  // Une nouvelle étape efface la cible qu'on visait.
  useEffect(() => setAim(null), [g.stage, g.seq]);

  // Sons et vibrations à chaque étape.
  const prev = useRef<{ stage: string; seq: number } | null>(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = { stage: g.stage, seq: g.seq };
    if (before && before.seq === g.seq) return;
    const me = view.me;
    if (g.stage === 'night') sfx.night();
    else if (g.stage === 'team' && g.leaderId === me) {
      sfx.turn();
      vibrate([30, 60, 30]);
    } else if (g.stage === 'vote' && g.order.includes(me)) {
      sfx.turn();
      vibrate(25);
    } else if (g.stage === 'votes') sfx.ballots(!!g.approved);
    else if (g.stage === 'quest' && g.team.includes(me)) {
      sfx.turn();
      vibrate([30, 60, 30]);
    } else if ((g.stage === 'lady' && g.ladyId === me) || (g.stage === 'assassin' && g.assassinId === me)) {
      sfx.turn();
      vibrate([30, 60, 30]);
    } else if (g.stage === 'over' && g.victory) {
      if (g.victory.target) sfx.stab();
      const won = g.me ? g.me.side === g.victory.side : false;
      window.setTimeout(() => sfx.fanfare(won, g.victory!.side === 'good'), g.victory.target ? 700 : 0);
    }
  }, [g.stage, g.seq, g.leaderId, g.team, g.order, g.approved, g.me, g.victory, g.ladyId, g.assassinId, view.me]);

  const pickable = (id: string): boolean => {
    if (g.stage === 'team') return g.leaderId === view.me;
    if (g.stage === 'lady') return g.ladyId === view.me && id !== view.me && !g.ladyUsed.includes(id);
    if (g.stage === 'assassin') return g.assassinId === view.me && id !== view.me;
    return false;
  };
  const onPick = (id: string) => {
    if (g.stage === 'team') {
      const on = !g.team.includes(id);
      if (on && g.team.length >= g.quests[g.quest].size) {
        useStore.getState().showToast(`L'équipe compte ${g.quests[g.quest].size} chevaliers : retires-en un d'abord.`, 'info');
        return;
      }
      sfx.pick(on);
      void send('game:toggle', { playerId: id, seq: g.seq });
    } else {
      sfx.tap();
      setAim(aim === id ? null : id);
    }
  };

  const event = g.events.map((e) => eventText(view, e)).filter(Boolean).pop();
  const center = (
    <div className="table-center">
      <div className="medals">
        {g.quests.map((q, i) => {
          const a = ((-90 + i * 72) * Math.PI) / 180;
          return (
            <div key={i} className="medal-slot" style={{ left: `${50 + 34 * Math.cos(a)}%`, top: `${50 + 34 * Math.sin(a)}%` }}>
              <QuestMedal size={q.size} needed={q.needed} result={q.result} current={i === g.quest && !q.result && g.stage !== 'over'} />
            </div>
          );
        })}
      </div>
      <div className="rejects" aria-label={`Équipes rejetées pour cette quête : ${g.rejects} sur 5`}>
        <span className="rejects-label">Rejets</span>
        <span className="rejects-pips">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className={cls('pip', i < g.rejects && 'is-on', i === 4 && 'is-last')} />
          ))}
        </span>
      </div>
    </div>
  );

  return (
    <div className={cls('table-screen', `stage-${g.stage}`)}>
      <header className="table-top">
        <Logo size="sm" />
        <span className="table-quest">
          {g.stage === 'over' ? 'Fin' : `Quête ${g.quest + 1}/5`}
        </span>
        <div className="table-tools">
          {g.me && (
            <button type="button" className="tool-btn" onClick={() => setRoleOpen(true)} aria-label="Mon rôle">
              <Eye size={18} />
              <span>Mon rôle</span>
            </button>
          )}
          {written && !wide && (
            <button type="button" className="tool-btn" onClick={() => setChatOpen(true)} aria-label={`Discussion${unread ? `, ${unread} nouveaux messages` : ''}`}>
              <MessageCircle size={18} />
              {unread > 0 && <span className="badge">{unread}</span>}
            </button>
          )}
          <button type="button" className="icon-btn" onClick={() => setRulesOpen(true)} aria-label="Règles">
            <BookOpen size={18} />
          </button>
          <button type="button" className="icon-btn" onClick={() => setMenu(true)} aria-label="Menu">
            <Menu size={18} />
          </button>
        </div>
      </header>

      <main className="table-main">
        <section className="round-wrap">
          <div className="round-table">
            <div className="round-top" aria-hidden />
            {center}
            {seats.map((s) => (
              <SeatView key={s.p.id} view={view} g={g} seat={s} pickable={pickable(s.p.id)} picked={aim === s.p.id || (g.stage === 'team' && g.team.includes(s.p.id) && g.leaderId === view.me)} onPick={onPick} />
            ))}
            <EmoteLayer seats={seats} />
            <AnimatePresence>
              {g.stage === 'votes' && g.approved !== null && (
                <motion.div key={`v${g.seq}`} className={cls('stamp is-center', g.approved ? 'is-success' : 'is-fail')} initial={{ scale: 1.5, opacity: 0, rotate: -12 }} animate={{ scale: 1, opacity: 1, rotate: -6 }} exit={{ opacity: 0, transition: { duration: 0.2 } }} transition={{ delay: 0.6, type: 'spring', stiffness: 300, damping: 16 }}>
                  {g.approved ? 'Acceptée' : 'Rejetée'}
                </motion.div>
              )}
              {g.stage === 'reveal' && g.reveal && (
                <motion.div key={`r${g.seq}`} className="reveal-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <RevealCards cards={g.reveal} needed={g.quests[g.quest].needed} seq={g.seq} />
                </motion.div>
              )}
              {g.stage === 'over' && g.victory && (
                <motion.div key="over" className={cls('stamp is-center is-big', g.victory.side === 'good' ? 'is-success' : 'is-fail')} initial={{ scale: 1.6, opacity: 0, rotate: -14 }} animate={{ scale: 1, opacity: 1, rotate: -5 }} transition={{ delay: g.victory.target ? 0.9 : 0.2, type: 'spring', stiffness: 260, damping: 15 }}>
                  {victoryTitle(g.victory)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <AnimatePresence>
            {event && (
              <motion.p key={event} className="event-line" initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}>
                {event}
              </motion.p>
            )}
          </AnimatePresence>
        </section>

        <aside className="side">
          <section className="action-panel" aria-live="polite">
            <ActionPanel view={view} g={g} aim={aim} setAim={setAim} />
          </section>
          {written && wide && <Chat view={view} g={g} docked />}
          <div className="react-row">
            <AnimatePresence>{react && <Reactions onClose={() => setReact(false)} />}</AnimatePresence>
            <Button variant="soft" icon={react ? <X size={18} /> : <Smile size={18} />} onClick={() => setReact((v) => !v)}>
              Réagir
            </Button>
          </div>
        </aside>
      </main>

      <AnimatePresence>{g.stage === 'night' && <Night view={view} g={g} />}</AnimatePresence>
      <RoleSheet view={view} />
      <LadyResult view={view} g={g} />
      {written && !wide && <Chat view={view} g={g} />}

      <Modal open={menu} onClose={() => setMenu(false)} title="Menu">
        <div className="menu-list">
          <Button icon={prefs.sound ? <Volume2 size={18} /> : <VolumeX size={18} />} onClick={() => setPrefs({ sound: !prefs.sound })}>
            {prefs.sound ? 'Couper le son' : 'Activer le son'}
          </Button>
          {isHost && (
            <Button
              icon={<Flag size={18} />}
              onClick={() => {
                setMenu(false);
                void send('game:end');
              }}
            >
              Arrêter la partie
            </Button>
          )}
          <Button variant="danger" icon={<LogOut size={18} />} onClick={() => void leaveRoom()}>
            Quitter la table
          </Button>
          <p className="muted small">Si tu quittes en pleine partie, le pilote automatique garde ta place.</p>
        </div>
      </Modal>
    </div>
  );
}
