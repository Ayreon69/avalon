// Les vitraux : rosace, fenêtre de chaque rôle, médaillons de quête, bulletins de vote et cartes de quête.
// Tout est dessiné en SVG, avec des plombs noirs épais autour de verres aux couleurs franches.
import { useId, type CSSProperties } from 'react';
import { SIDE, type Card, type Role } from '../../../shared/protocol';
import { cls } from '../lib/util';

const LEAD = '#05060c';

const GLASS = {
  good: ['#1b3e9e', '#2e6fe0', '#16307a', '#3f86f0', '#24479f', '#1e9e74', '#2b5fc4', '#163a8a'],
  evil: ['#8e1530', '#c22a45', '#5a1030', '#e0475c', '#4a1f6e', '#6e1838', '#a3203b', '#3a1450'],
  back: ['#20253d', '#2a3050', '#1a1e33', '#30375c', '#252b47', '#1d2238', '#2c3354', '#222842'],
};

/** Une étoile à n branches. */
function star(cx: number, cy: number, outer: number, inner: number, points: number, rot = -90): string {
  const out: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = ((rot + (i * 180) / points) * Math.PI) / 180;
    out.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return out.join(' ');
}

/** Le motif central de chaque rôle, dans un médaillon de 30 de rayon centré en (60, 96). */
function Emblem({ role }: { role: Role | null }) {
  const s = { stroke: LEAD, strokeWidth: 3, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  switch (role) {
    case 'merlin':
      return (
        <g {...s}>
          <polygon points={star(60, 94, 24, 9, 8)} fill="#f0b43c" />
          <polygon points={star(60, 94, 10, 4, 4, -45)} fill="#fff6d8" strokeWidth={2} />
          <circle cx="41" cy="115" r="3" fill="#fff6d8" strokeWidth={1.6} />
          <circle cx="80" cy="74" r="2.6" fill="#fff6d8" strokeWidth={1.6} />
        </g>
      );
    case 'perceval':
      return (
        <g {...s}>
          <path d="M42 74 H78 V96 Q78 116 60 125 Q42 116 42 96 Z" fill="#e8ecf8" />
          <path d="M56 78 H64 V92 H74 V100 H64 V119 L60 121 L56 119 V100 H46 V92 H56 Z" fill="#2e6fe0" strokeWidth={2.4} />
        </g>
      );
    case 'servant':
      return (
        <g {...s}>
          <path d="M44 74 H76 Q76 99 60 102 Q44 99 44 74 Z" fill="#f0b43c" />
          <path d="M47 80 H73" stroke="#c22a45" strokeWidth={4} />
          <path d="M57 102 H63 V114 H57 Z" fill="#e8c46a" />
          <path d="M46 123 Q60 110 74 123 Z" fill="#f0b43c" />
        </g>
      );
    case 'assassin':
      return (
        <g {...s}>
          <path d="M60 68 L67 99 L60 107 L53 99 Z" fill="#dfe3ee" />
          <path d="M60 72 V102" stroke="#9aa3bd" strokeWidth={1.6} />
          <path d="M46 105 H74 V111 H46 Z" fill="#f0b43c" />
          <path d="M57 111 H63 V122 H57 Z" fill="#3a2a22" />
          <circle cx="60" cy="126" r="4" fill="#f0b43c" />
        </g>
      );
    case 'morgane':
      return (
        <g {...s}>
          <path d="M70 70 A27 27 0 1 0 70 122 A21 21 0 1 1 70 70 Z" fill="#d8d0ff" />
          <polygon points={star(76, 88, 8, 3, 4)} fill="#f0b43c" strokeWidth={2} />
          <circle cx="47" cy="96" r="3" fill="#c22a45" strokeWidth={1.6} />
        </g>
      );
    case 'mordred':
      return (
        <g {...s}>
          <path d="M40 116 L44 82 L53 97 L60 74 L67 97 L76 82 L80 116 Z" fill="#c9962f" />
          <path d="M40 116 H80 V124 H40 Z" fill="#8a6418" />
          <path d="M61 76 L57 92 L64 100 L58 116" fill="none" strokeWidth={2.6} />
          <circle cx="60" cy="106" r="3.4" fill="#c22a45" strokeWidth={1.8} />
        </g>
      );
    case 'oberon':
      return (
        <g {...s}>
          <path d="M60 68 Q82 76 82 106 L78 125 H42 L38 106 Q38 76 60 68 Z" fill="#3a1450" />
          <ellipse cx="60" cy="101" rx="11" ry="14" fill="#05060c" strokeWidth={2} />
          <circle cx="55.5" cy="99" r="2" fill="#e0475c" stroke="none" />
          <circle cx="64.5" cy="99" r="2" fill="#e0475c" stroke="none" />
        </g>
      );
    case 'minion':
      return (
        <g {...s}>
          <path d="M57 82 H63 V113 L60 121 L57 113 Z" fill="#dfe3ee" />
          <path d="M46 77 H74 V83 H46 Z" fill="#8a6418" />
          <path d="M57 66 H63 V77 H57 Z" fill="#3a2a22" />
          <circle cx="60" cy="64" r="3.6" fill="#8a6418" />
          <path d="M69 118 Q73 124 69 128 Q65 124 69 118 Z" fill="#c22a45" strokeWidth={1.8} />
        </g>
      );
    default:
      return (
        <g {...s}>
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i * 45 * Math.PI) / 180;
            return <circle key={i} cx={60 + 15 * Math.cos(a)} cy={96 + 15 * Math.sin(a)} r="8" fill={i % 2 ? '#30375c' : '#3c4470'} strokeWidth={2.4} />;
          })}
          <circle cx="60" cy="96" r="8" fill="#e8c46a" strokeWidth={2.4} />
        </g>
      );
  }
}

const PANES = [
  '0,0 60,0 60,40 20,60 0,50',
  '60,0 120,0 120,50 100,60 60,40',
  '0,50 20,60 26,110 0,122',
  '120,50 100,60 94,110 120,122',
  '0,122 26,110 40,150 18,190 0,190',
  '120,122 94,110 80,150 102,190 120,190',
  '40,150 80,150 102,190 18,190',
  '20,60 60,40 100,60 94,110 80,150 40,150 26,110',
];

/**
 * Une fenêtre en ogive : verres aux couleurs du camp, médaillon central et emblème du rôle.
 * Sans rôle, c'est le dos de la carte : des verres sombres et une petite rosace.
 */
export function RoleWindow({ role, lit = true, className, style }: { role: Role | null; lit?: boolean; className?: string; style?: CSSProperties }) {
  const id = useId().replace(/:/g, '');
  const side = role ? SIDE[role] : null;
  const glass = side ? GLASS[side] : GLASS.back;
  const arch = 'M6 190 V80 Q6 24 60 5 Q114 24 114 80 V190 Z';
  return (
    <svg viewBox="0 0 120 196" className={cls('role-window', side && `is-${side}`, !lit && 'is-dark', className)} style={style} aria-hidden>
      <defs>
        <clipPath id={`arch${id}`}>
          <path d={arch} />
        </clipPath>
        <radialGradient id={`light${id}`} cx="0.3" cy="0.18" r="0.9">
          <stop offset="0" stopColor="#fff" stopOpacity="0.38" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0.08" />
          <stop offset="1" stopColor="#000" stopOpacity="0.25" />
        </radialGradient>
      </defs>
      <g clipPath={`url(#arch${id})`}>
        {PANES.map((p, i) => (
          <polygon key={i} className="pane" points={p} fill={glass[i]} stroke={LEAD} strokeWidth="3" strokeLinejoin="round" style={{ '--i': i } as CSSProperties} />
        ))}
        <circle cx="60" cy="96" r="34" fill={side === 'evil' ? '#2a0c1c' : side === 'good' ? '#0f2160' : '#161a2e'} stroke={LEAD} strokeWidth="4" />
        <circle cx="60" cy="96" r="29" fill="none" stroke={side === 'evil' ? '#e0475c' : side === 'good' ? '#e8c46a' : '#3c4470'} strokeWidth="1.6" opacity="0.8" />
        <g className="emblem">
          <Emblem role={role} />
        </g>
        <path d="M60 5 V40 M6 80 H20 M114 80 H100" stroke={LEAD} strokeWidth="2.4" />
        <rect width="120" height="196" fill={`url(#light${id})`} className="glass-light" />
      </g>
      <path d={arch} fill="none" stroke={LEAD} strokeWidth="6" strokeLinejoin="round" />
      <path d={arch} fill="none" stroke={side === 'evil' ? '#7a2034' : '#8a6a2a'} strokeWidth="1.6" strokeLinejoin="round" transform="translate(60 98) scale(0.94) translate(-60 -98)" opacity="0.9" />
    </svg>
  );
}

/** La grande rosace de l'accueil : douze pétales de verre autour d'une fleur, la lumière qui tourne derrière. */
export function Rosace({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  const colors = ['#2e6fe0', '#c22a45', '#f0b43c', '#1e9e74', '#3f86f0', '#7a3fb8'];
  const petal = (i: number, r0: number, r1: number, spread: number) => {
    const a = ((i * 30 - 90) * Math.PI) / 180;
    const p = (r: number, da: number) => `${(100 + r * Math.cos(a + da)).toFixed(2)} ${(100 + r * Math.sin(a + da)).toFixed(2)}`;
    return `M${p(r0, 0)} Q${p((r0 + r1) / 2, -spread)} ${p(r1, 0)} Q${p((r0 + r1) / 2, spread)} ${p(r0, 0)} Z`;
  };
  return (
    <svg viewBox="0 0 200 200" className={cls('rosace', className)} aria-hidden>
      <defs>
        <radialGradient id={`rl${id}`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="97" fill="#0d1124" stroke={LEAD} strokeWidth="6" />
      <circle cx="100" cy="100" r="91" fill="none" stroke="#8a6a2a" strokeWidth="1.5" />
      <g className="rosace-petals" stroke={LEAD} strokeWidth="3.2" strokeLinejoin="round">
        {Array.from({ length: 12 }, (_, i) => (
          <path key={i} className="petal" d={petal(i, 36, 90, 0.3)} fill={colors[i % colors.length]} style={{ '--i': i } as CSSProperties} />
        ))}
        {Array.from({ length: 12 }, (_, i) => {
          const a = ((i * 30 - 75) * Math.PI) / 180;
          return <circle key={`c${i}`} cx={100 + 80 * Math.cos(a)} cy={100 + 80 * Math.sin(a)} r="6.5" fill={i % 2 ? '#e8c46a' : '#3f86f0'} />;
        })}
        <circle cx="100" cy="100" r="36" fill="#1b3e9e" />
        {Array.from({ length: 6 }, (_, i) => {
          const a = ((i * 60 - 90) * Math.PI) / 180;
          return <circle key={`f${i}`} cx={100 + 17 * Math.cos(a)} cy={100 + 17 * Math.sin(a)} r="12" fill={i % 2 ? '#c22a45' : '#f0b43c'} />;
        })}
        <circle cx="100" cy="100" r="10" fill="#fff6d8" />
      </g>
      <circle cx="100" cy="100" r="94" fill={`url(#rl${id})`} />
    </svg>
  );
}

/** Un médaillon de quête : la taille de l'équipe, et le résultat une fois la quête jouée. */
export function QuestMedal({ size, needed, result, current }: { size: number; needed: number; result: Card | null; current?: boolean }) {
  return (
    <div className={cls('medal', result && `is-${result}`, current && 'is-current')}>
      <svg viewBox="0 0 60 60" aria-hidden>
        <circle cx="30" cy="30" r="27" className="medal-glass" stroke={LEAD} strokeWidth="4" />
        <circle cx="30" cy="30" r="21.5" fill="none" className="medal-ring" strokeWidth="1.6" />
        {result === 'success' && (
          <g stroke={LEAD} strokeWidth="2.4" strokeLinejoin="round">
            <path d="M20 19 H40 Q40 33 30 35 Q20 33 20 19 Z" fill="#f0b43c" />
            <path d="M28 35 H32 V41 H28 Z" fill="#e8c46a" />
            <path d="M21 46 Q30 39 39 46 Z" fill="#f0b43c" />
          </g>
        )}
        {result === 'fail' && (
          <g stroke={LEAD} strokeWidth="2.4" strokeLinejoin="round">
            <path d="M30 13 L35 34 L30 40 L25 34 Z" fill="#dfe3ee" />
            <path d="M21 38 H39 V42 H21 Z" fill="#f0b43c" />
            <path d="M28 42 H32 V48 H28 Z" fill="#3a2a22" />
          </g>
        )}
      </svg>
      {!result && <span className="medal-size">{size}</span>}
      {needed > 1 && !result && (
        <span className="medal-needed" title="Il faut deux cartes Échec pour faire échouer cette quête">
          2 échecs
        </span>
      )}
    </div>
  );
}

/** Un bulletin de vote : un soleil d'or pour, une lune noire contre. */
export function Ballot({ yes, className }: { yes: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cls('ballot', yes ? 'is-yes' : 'is-no', className)} aria-label={yes ? 'Pour' : 'Contre'} role="img">
      {yes ? (
        <g stroke={LEAD} strokeWidth="2.4" strokeLinejoin="round">
          <polygon points={star(20, 20, 18, 11, 12)} fill="#f0b43c" />
          <circle cx="20" cy="20" r="9" fill="#fff0c2" />
        </g>
      ) : (
        <g stroke={LEAD} strokeWidth="2.4" strokeLinejoin="round">
          <circle cx="20" cy="20" r="17" fill="#2a1630" />
          <path d="M13 13 L27 27 M27 13 L13 27" stroke="#e0475c" strokeWidth="4" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}

/** Une carte de quête : Réussite (un calice de lumière) ou Échec (une dague). */
export function QuestCard({ card, className }: { card: Card | null; className?: string }) {
  const id = useId().replace(/:/g, '');
  const good = card === 'success';
  const panes = card === null ? GLASS.back : good ? GLASS.good : GLASS.evil;
  return (
    <svg viewBox="0 0 100 140" className={cls('quest-card', card && `is-${card}`, className)} aria-hidden>
      <defs>
        <clipPath id={`qc${id}`}>
          <rect x="4" y="4" width="92" height="132" rx="10" />
        </clipPath>
      </defs>
      <g clipPath={`url(#qc${id})`} stroke={LEAD} strokeWidth="3" strokeLinejoin="round">
        <polygon points="0,0 50,0 50,30 0,46" fill={panes[0]} />
        <polygon points="50,0 100,0 100,46 50,30" fill={panes[1]} />
        <polygon points="0,46 50,30 100,46 100,96 50,112 0,96" fill={panes[2]} />
        <polygon points="0,96 50,112 50,140 0,140" fill={panes[3]} />
        <polygon points="50,112 100,96 100,140 50,140" fill={panes[4]} />
        <circle cx="50" cy="70" r="30" fill={card === null ? '#161a2e' : good ? '#0f2160' : '#2a0c1c'} strokeWidth="3.4" />
        {card === 'success' && (
          <g strokeWidth="2.6">
            <path d="M34 50 H66 Q66 75 50 78 Q34 75 34 50 Z" fill="#f0b43c" />
            <path d="M47 78 H53 V88 H47 Z" fill="#e8c46a" />
            <path d="M36 96 Q50 85 64 96 Z" fill="#f0b43c" />
            <path d="M38 56 H62" stroke="#fff6d8" strokeWidth="2" />
          </g>
        )}
        {card === 'fail' && (
          <g strokeWidth="2.6">
            <path d="M50 44 L57 75 L50 83 L43 75 Z" fill="#dfe3ee" />
            <path d="M36 81 H64 V87 H36 Z" fill="#f0b43c" />
            <path d="M47 87 H53 V97 H47 Z" fill="#3a2a22" />
            <circle cx="50" cy="100" r="3.6" fill="#f0b43c" />
          </g>
        )}
        {card === null && <circle cx="50" cy="70" r="8" fill="#e8c46a" strokeWidth="2.4" />}
      </g>
      <rect x="4" y="4" width="92" height="132" rx="10" fill="none" stroke={LEAD} strokeWidth="5" />
    </svg>
  );
}

/** La couronne du meneur. */
export function CrownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 24" className={cls('crown-icon', className)} aria-hidden>
      <path d="M3 20 L5 6 L11 13 L16 3 L21 13 L27 6 L29 20 Z" fill="#f0b43c" stroke={LEAD} strokeWidth="2.2" strokeLinejoin="round" />
      <circle cx="16" cy="15" r="2.2" fill="#c22a45" stroke={LEAD} strokeWidth="1.4" />
    </svg>
  );
}

/** Le bouclier des chevaliers choisis pour la quête. */
export function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 28" className={cls('shield-icon', className)} aria-hidden>
      <path d="M3 3 H21 V13 Q21 22 12 26 Q3 22 3 13 Z" fill="#2e6fe0" stroke={LEAD} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M10.5 6 H13.5 V11 H18 V14 H13.5 V22 H10.5 V14 H6 V11 H10.5 Z" fill="#f0b43c" stroke={LEAD} strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

/** La Dame du Lac : une goutte d'eau claire. */
export function LadyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 28" className={cls('lady-icon', className)} aria-hidden>
      <path d="M12 2 Q21 14 21 18 A9 9 0 0 1 3 18 Q3 14 12 2 Z" fill="#5fd0e8" stroke={LEAD} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M8 18 A4 4 0 0 0 12 22" fill="none" stroke="#e8fbff" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
