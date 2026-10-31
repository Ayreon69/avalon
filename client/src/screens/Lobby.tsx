// Salon : partage de la table, joueurs, rôles en jeu, réglages de l'hôte et lancement.
import { motion } from 'framer-motion';
import { BookOpen, Bot, Check, Copy, Crown, LogOut, Play, QrCode, Share2, Trophy, UserX } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import { EVIL_COUNT, MAX_PLAYERS, MIN_PLAYERS, TIMER_OPTIONS, evilSpecials, rolesProblem, type PlayerView, type Role, type RoomView, type Talk, type Timer } from '../../../shared/protocol';
import { LadyIcon, RoleBlazon } from '../components/Art';
import { Avatar, Backdrop, Button, Logo, Modal, Pill, RoleToggle, Segmented } from '../components/Ui';
import { roleName } from '../lib/text';
import { cls, shareUrl } from '../lib/util';
import { leaveRoom, send } from '../net';
import { useStore } from '../store';

function PlayerRow({ view, p, i, isHost }: { view: RoomView; p: PlayerView; i: number; isHost: boolean }) {
  return (
    <motion.li className={cls('player-row', p.id === view.me && 'is-me')} initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.03 }}>
      <Avatar avatar={p.avatar} className="player-avatar" />
      <span className="player-name">
        {p.name}
        {p.id === view.me && <span className="muted"> (toi)</span>}
      </span>
      {p.wins > 0 && (
        <Pill tone="gold" className="wins-pill">
          <Trophy size={12} aria-hidden /> {p.wins}
        </Pill>
      )}
      {p.isHost && (
        <Pill tone="ruby">
          <Crown size={12} aria-hidden /> Hôte
        </Pill>
      )}
      {p.isBot && <Pill tone="azure">Bot</Pill>}
      {!p.connected && <Pill>Hors ligne</Pill>}
      {isHost && p.id !== view.me && (
        <button type="button" className="icon-btn" aria-label={`Retirer ${p.name}`} onClick={() => void send('room:kick', { playerId: p.id })}>
          <UserX size={18} />
        </button>
      )}
    </motion.li>
  );
}

/** Les rôles qui seront distribués à ce nombre de joueurs, dans l'ordre : le Bien, puis le Mal. */
function deck(view: RoomView, count: number): Role[] {
  const n = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, count));
  const evil = EVIL_COUNT[n];
  const bad = evilSpecials(view.settings).slice(0, evil);
  while (bad.length < evil) bad.push('minion');
  const good: Role[] = ['merlin'];
  if (view.settings.perceval) good.push('perceval');
  while (good.length < n - evil) good.push('servant');
  return [...good, ...bad];
}

export function Lobby({ view }: { view: RoomView }) {
  const setRulesOpen = useStore((s) => s.setRulesOpen);
  const isHost = view.hostId === view.me;
  const seated = view.players.filter((p) => p.status !== 'spectator');
  const spectators = view.players.filter((p) => p.status === 'spectator');
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState(false);
  const url = shareUrl(view.code);
  const host = view.players.find((p) => p.id === view.hostId);
  const s = view.settings;
  const count = seated.length;
  const shownCount = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, count));
  const problem = rolesProblem(s, shownCount);
  const blocked = count < MIN_PLAYERS ? `Il faut au moins ${MIN_PLAYERS} joueurs` : problem ? 'Trop de rôles du Mal' : null;
  const roles = deck(view, count);
  const evilPlaces = EVIL_COUNT[shownCount];
  const specials = evilSpecials(s).length;
  const set = (patch: Record<string, unknown>) => void send('room:settings', patch);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      useStore.getState().showToast(`Lien : ${url}`, 'info');
    }
  };
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Avalon', text: `Rejoins ma table d'Avalon (code ${view.code}) !`, url });
      } catch {
        /* partage annulé */
      }
    } else void copy();
  };

  return (
    <Backdrop>
      <div className="lobby">
        <header className="lobby-top">
          <Logo size="sm" />
          <Button variant="ghost" icon={<LogOut size={18} />} onClick={() => void leaveRoom()}>
            Quitter
          </Button>
        </header>

        <motion.section className="code-panel" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <span className="eyebrow">Code de la table</span>
          <div className="big-code" aria-label={`Code ${view.code.split('').join(' ')}`}>
            {view.code.split('').map((c, i) => (
              <motion.span key={i} className={`is-c${i}`} initial={{ y: -18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.07, type: 'spring', stiffness: 260, damping: 16 }}>
                {c}
              </motion.span>
            ))}
          </div>
          <div className="share-row">
            <Button variant="primary" icon={<Share2 size={18} />} onClick={share}>
              Inviter des amis
            </Button>
            <Button icon={copied ? <Check size={18} /> : <Copy size={18} />} onClick={copy}>
              {copied ? 'Lien copié !' : 'Copier le lien'}
            </Button>
            <Button icon={<QrCode size={18} />} onClick={() => setQr(true)} aria-label="Afficher le QR code">
              QR
            </Button>
          </div>
        </motion.section>

        <div className="lobby-grid">
          <section className="panel">
            <div className="panel-head">
              <h3>
                Chevaliers <span className="muted">{count}/{MAX_PLAYERS}</span>
              </h3>
              {isHost && (
                <Button variant="soft" icon={<Bot size={18} />} disabled={count >= MAX_PLAYERS} onClick={() => void send('room:addBot')}>
                  Ajouter un bot
                </Button>
              )}
            </div>
            <ul className="player-list">
              {seated.map((p, i) => (
                <PlayerRow key={p.id} view={view} p={p} i={i} isHost={isHost} />
              ))}
              {Array.from({ length: Math.max(0, MIN_PLAYERS - count) }, (_, i) => (
                <li key={`empty${i}`} className="player-row is-empty">
                  <span className="player-ghost">?</span>
                  <span className="player-name muted">Une place à prendre…</span>
                </li>
              ))}
            </ul>
            {spectators.length > 0 && <p className="muted small">Spectateurs : {spectators.map((p) => p.name).join(', ')}</p>}
            <p className="muted small lobby-note">De 5 à 10 joueurs. Les bots votent et jouent, mais ne parlent pas : rien ne vaut de vrais amis autour de la table.</p>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>Les rôles de la partie</h3>
              {!isHost && <span className="muted small">choisis par {host?.name ?? "l'hôte"}</span>}
            </div>
            <div className="deck" aria-label={`À ${shownCount} joueurs : ${roles.map(roleName).join(', ')}`}>
              {roles.map((r, i) => (
                <motion.div key={`${r}${i}`} className="deck-card" initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.03 }}>
                  <RoleBlazon role={r} />
                  <span>{roleName(r).replace('Serviteur loyal d’Arthur', 'Loyal').replace('Sbire de Mordred', 'Sbire').replace('L’Assassin', 'Assassin')}</span>
                </motion.div>
              ))}
            </div>
            <p className="muted small lobby-note">
              À {shownCount} : {shownCount - evilPlaces} loyaux contre {evilPlaces} sbires.
              {count < MIN_PLAYERS && ` (aperçu à ${MIN_PLAYERS})`}
            </p>
            <div className="toggles">
              <RoleToggle
                on={s.perceval}
                disabled={!isHost || (!s.perceval && specials + 1 > evilPlaces)}
                onChange={(perceval) => set({ perceval })}
                icon={<RoleBlazon role="perceval" />}
                title="Perceval et Morgane"
                sub="Perceval voit Merlin… et Morgane, qui prend son visage."
              />
              <RoleToggle on={s.mordred} disabled={!isHost || (!s.mordred && specials + 1 > evilPlaces)} onChange={(mordred) => set({ mordred })} icon={<RoleBlazon role="mordred" />} title="Mordred" sub="Invisible aux yeux de Merlin." />
              <RoleToggle on={s.oberon} disabled={!isHost || (!s.oberon && specials + 1 > evilPlaces)} onChange={(oberon) => set({ oberon })} icon={<RoleBlazon role="oberon" />} title="Oberon" sub="Sert Mordred, mais seul : ses complices l'ignorent." />
              <RoleToggle on={s.lady} disabled={!isHost} onChange={(lady) => set({ lady })} icon={<LadyIcon />} title="La Dame du Lac" sub="Sonder un joueur après les quêtes 2, 3 et 4. Conseillée dès 7." />
            </div>
            {problem && <p className="lobby-warn">{problem}</p>}

            <span className="field-label">Le débat</span>
            <Segmented<Talk>
              label="Le débat"
              value={s.talk}
              disabled={!isHost}
              onChange={(talk) => set({ talk })}
              options={[
                { value: 'oral', label: 'À voix haute', sub: 'autour d’une table ou en appel' },
                { value: 'ecrit', label: 'Par écrit', sub: 'une discussion dans l’appli' },
              ]}
            />
            <span className="field-label">Temps pour proposer une équipe</span>
            <Segmented<Timer>
              label="Temps pour proposer une équipe"
              value={s.timer}
              disabled={!isHost}
              onChange={(timer) => set({ timer })}
              options={TIMER_OPTIONS.map((t) => ({ value: t, label: t === 0 ? 'Sans limite' : `${t / 60} min` }))}
            />
            {s.timer > 0 && <p className="muted small lobby-note">Le temps écoulé, le pilote automatique propose à la place du meneur. Les votes et les cartes de quête ont 45 secondes.</p>}
          </section>
        </div>

        <div className="lobby-cta">
          {isHost ? (
            <Button variant="primary" className="btn-lg btn-wide" icon={<Play size={20} />} disabled={!!blocked} onClick={() => void send('game:start')}>
              {blocked ?? `Lancer la partie (${count} joueurs)`}
            </Button>
          ) : (
            <div className="waiting" role="status">
              <span className="spinner" /> En attente que {host?.name ?? "l'hôte"} lance la partie…
            </div>
          )}
          <Button variant="ghost" icon={<BookOpen size={18} />} onClick={() => setRulesOpen(true)}>
            Nouveau ? Les règles en 3 minutes
          </Button>
        </div>

        <Modal open={qr} onClose={() => setQr(false)} title={`Table ${view.code}`}>
          <div className="qr-box">
            <QRCodeSVG value={url} size={220} bgColor="#fbf5e6" fgColor="#1c1510" level="M" includeMargin />
            <p className="muted small">Scanne pour rejoindre la table directement.</p>
            <code className="url-code">{url}</code>
          </div>
        </Modal>
      </div>
    </Backdrop>
  );
}
