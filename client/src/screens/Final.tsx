// Fin de partie : le camp vainqueur, puis tous les rôles dévoilés, et la revanche en un clic.
import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';
import { BookOpen, LogOut, RotateCcw, Trophy } from 'lucide-react';
import { useEffect } from 'react';
import type { RoomView } from '../../../shared/protocol';
import { QuestMedal, RoleWindow } from '../components/Art';
import { Avatar, Backdrop, Button, Logo, Pill } from '../components/Ui';
import { SIDE_SHORT, roleName, victoryText, victoryTitle } from '../lib/text';
import { cls, reducedMotion } from '../lib/util';
import { leaveRoom, send } from '../net';
import { useStore } from '../store';

export function Final({ view }: { view: RoomView }) {
  const f = view.final!;
  const v = f.victory;
  const setRulesOpen = useStore((s) => s.setRulesOpen);
  const isHost = view.hostId === view.me;
  const mine = f.players.find((p) => p.id === view.me);
  const host = view.players.find((p) => p.id === view.hostId);
  const good = f.players.filter((p) => p.side === 'good');
  const evil = f.players.filter((p) => p.side === 'evil');

  useEffect(() => {
    if (!mine?.winner || reducedMotion()) return;
    const colors = v.side === 'good' ? ['#f0b43c', '#2e6fe0', '#e8c46a', '#3f86f0', '#fff6d8'] : ['#c22a45', '#e0475c', '#4a1f6e', '#f0b43c', '#8e1530'];
    const t = window.setTimeout(() => {
      confetti({ particleCount: 90, spread: 75, origin: { y: 0.25 }, colors, scalar: 0.9, disableForReducedMotion: true });
      confetti({ particleCount: 40, angle: 60, spread: 55, origin: { x: 0, y: 0.5 }, colors, disableForReducedMotion: true });
      confetti({ particleCount: 40, angle: 120, spread: 55, origin: { x: 1, y: 0.5 }, colors, disableForReducedMotion: true });
    }, 350);
    return () => window.clearTimeout(t);
  }, [mine?.winner, v.side]);

  const Group = ({ title, list, side }: { title: string; list: typeof f.players; side: 'good' | 'evil' }) => (
    <section className={cls('final-group', `is-${side}`)}>
      <h3>{title}</h3>
      <ul className="final-roles">
        {list.map((p, i) => (
          <motion.li
            key={p.id}
            className={cls('final-player', p.id === view.me && 'is-me', p.winner && 'is-winner', f.target === p.id && 'is-target')}
            initial={{ y: 18, opacity: 0, rotateY: 80 }}
            animate={{ y: 0, opacity: 1, rotateY: 0 }}
            transition={{ delay: 0.5 + i * 0.09, duration: 0.45 }}
          >
            <RoleWindow role={p.role} />
            <span className="final-name">
              <Avatar avatar={p.avatar} /> {p.id === view.me ? 'Toi' : p.name}
            </span>
            <span className="final-role">{roleName(p.role)}</span>
            {f.target === p.id && <span className="final-mark">{v.reason === 'assassinated' ? 'Assassiné' : 'Visé'}</span>}
            {p.wins > 0 && (
              <Pill tone="gold" className="wins-pill">
                <Trophy size={12} aria-hidden /> {p.wins}
              </Pill>
            )}
          </motion.li>
        ))}
      </ul>
    </section>
  );

  return (
    <Backdrop quiet className={cls('final-screen', `is-${v.side}`)}>
      <div className="final">
        <header className="lobby-top">
          <Logo size="sm" />
          <Button variant="ghost" icon={<BookOpen size={18} />} onClick={() => setRulesOpen(true)}>
            Règles
          </Button>
        </header>

        <motion.section className="final-hero" initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }}>
          <p className="kicker">{mine ? (mine.winner ? `Victoire pour ${SIDE_SHORT[mine.side]} !` : `Défaite pour ${SIDE_SHORT[mine.side]}…`) : 'Fin de la partie'}</p>
          <h1 className={cls('final-title', v.side === 'good' ? 't-good' : 't-evil')}>{victoryTitle(v)}</h1>
          <p className="final-text">{victoryText(view, v)}</p>
          <div className="final-medals">
            {f.quests.map((q, i) => (
              <QuestMedal key={i} size={q.size} needed={q.needed} result={q.result} />
            ))}
          </div>
        </motion.section>

        <div className="final-groups">
          <Group title="Les loyaux d’Arthur" list={good} side="good" />
          <Group title="Les sbires de Mordred" list={evil} side="evil" />
        </div>

        <div className="lobby-cta">
          {isHost ? (
            <Button variant="primary" className="btn-lg btn-wide" icon={<RotateCcw size={20} />} onClick={() => void send('game:restart')}>
              Revanche
            </Button>
          ) : (
            <div className="waiting" role="status">
              <span className="spinner" /> {host?.name ?? "L'hôte"} peut relancer une partie…
            </div>
          )}
          <Button variant="ghost" icon={<LogOut size={18} />} onClick={() => void leaveRoom()}>
            Quitter la table
          </Button>
        </div>
      </div>
    </Backdrop>
  );
}
