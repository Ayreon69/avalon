// Ton rôle : la fenêtre qu'on touche pour l'allumer, ce qu'elle t'apprend des autres, et la fiche consultable en partie.
import { AnimatePresence, motion } from 'framer-motion';
import { EyeOff, Hand } from 'lucide-react';
import { useState } from 'react';
import type { MyRole, RoomView } from '../../../shared/protocol';
import { sfx } from '../lib/sound';
import { ROLE_TEXT, SIDE_NAMES, blindSpot, glimpseLabel, glimpseTitle, nameOf, roleName } from '../lib/text';
import { cls, vibrate } from '../lib/util';
import { useStore } from '../store';
import { RoleWindow } from './Art';
import { Avatar, Modal } from './Ui';

/** La fenêtre de ton rôle, éteinte tant que tu ne la touches pas : personne ne lit par-dessus ton épaule. */
export function RoleReveal({ view, me, startShown = false }: { view: RoomView; me: MyRole; startShown?: boolean }) {
  const [shown, setShown] = useState(startShown);
  const toggle = () => {
    if (!shown) {
      sfx.reveal(me.side === 'evil');
      vibrate(30);
    }
    setShown((v) => !v);
  };
  const title = glimpseTitle(me.role);
  const blind = blindSpot(me.role, view);
  return (
    <div className={cls('role-reveal', shown && 'is-shown', `is-${me.side}`)}>
      <button type="button" className="role-reveal-window" onClick={toggle} aria-label={shown ? 'Cacher mon rôle' : 'Révéler mon rôle'}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={shown ? 'on' : 'off'} initial={{ rotateY: 90, opacity: 0.4 }} animate={{ rotateY: 0, opacity: 1 }} exit={{ rotateY: -90, opacity: 0.4 }} transition={{ duration: 0.28 }}>
            <RoleWindow role={shown ? me.role : null} />
          </motion.div>
        </AnimatePresence>
        <span className="role-reveal-hint">
          {shown ? (
            <>
              <EyeOff size={14} aria-hidden /> Toucher pour cacher
            </>
          ) : (
            <>
              <Hand size={14} aria-hidden /> Touche pour révéler
            </>
          )}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {shown && (
          <motion.div className="role-info" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <span className={cls('side-tag', `is-${me.side}`)}>{SIDE_NAMES[me.side]}</span>
            <h2 className="role-name">{roleName(me.role)}</h2>
            <p className="role-text">{ROLE_TEXT[me.role]}</p>
            {title && me.sees.length > 0 && (
              <div className="glimpse">
                <span className="field-label">{title}</span>
                <ul>
                  {me.sees.map((s) => {
                    const p = view.players.find((x) => x.id === s.id);
                    return (
                      <li key={s.id} className={cls('glimpse-row', s.as === 'evil' && 'is-evil')}>
                        <Avatar avatar={p?.avatar ?? 'lion'} />
                        <b>{p?.name ?? '?'}</b>
                        <span>{glimpseLabel(s.as)}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {blind && <p className="muted small">{blind}</p>}
            {me.ladyNotes.length > 0 && (
              <div className="glimpse">
                <span className="field-label">Ce que la Dame du Lac t'a montré</span>
                <ul>
                  {me.ladyNotes.map((n) => (
                    <li key={n.target} className={cls('glimpse-row', n.side === 'evil' && 'is-evil')}>
                      <Avatar avatar={view.players.find((x) => x.id === n.target)?.avatar ?? 'lion'} />
                      <b>{nameOf(view, n.target)}</b>
                      <span>{n.side === 'good' ? 'Loyal à Arthur' : 'Sert Mordred'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** La fiche de rôle, ouverte à la demande pendant la partie. */
export function RoleSheet({ view }: { view: RoomView }) {
  const open = useStore((s) => s.roleOpen);
  const setOpen = useStore((s) => s.setRoleOpen);
  const me = view.game?.me;
  if (!me) return null;
  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Mon rôle" className="role-modal">
      <RoleReveal view={view} me={me} />
    </Modal>
  );
}
