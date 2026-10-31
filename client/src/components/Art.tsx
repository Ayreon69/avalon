// La tapisserie : le blason de chaque rôle, la scène de l'accueil, les médaillons de quête, les bulletins et les cartes.
// Tout est dessiné en SVG, comme brodé : des couleurs franches, un fil sombre autour et des points de couture.
import { useId } from 'react';
import { SIDE, type Card, type Role } from '../../../shared/protocol';
import { cls } from '../lib/util';

const FIL = '#1c1510';
const OR = '#f0bd45';
const ARGENT = '#f3ead6';
const AZUR = '#1f4e96';
const GUEULES = '#a62c1e';
const VERDURE = '#2f5f54';
const SEMIS = '#fff6df';

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

/** Une fleur à cinq pétales, comme celles du semis. */
function Flower({ x, y, r, fill, core = OR, stroke }: { x: number; y: number; r: number; fill: string; core?: string; stroke?: string }) {
  return (
    <g stroke={stroke} strokeWidth={stroke ? 1 : undefined}>
      {[0, 72, 144, 216, 288].map((d) => {
        const a = ((d - 90) * Math.PI) / 180;
        return <circle key={d} cx={x + r * Math.cos(a)} cy={y + r * Math.sin(a)} r={r * 0.72} fill={fill} />;
      })}
      <circle cx={x} cy={y} r={r * 0.5} fill={core} />
    </g>
  );
}

/** La couleur du champ et de la bordure : or pour les loyaux, gueules pour les sbires, sinople pour le dos. */
const FIELD: Record<Role, string> = {
  merlin: AZUR,
  perceval: AZUR,
  servant: AZUR,
  assassin: '#1b1714',
  morgane: '#47205c',
  mordred: '#3a100b',
  oberon: '#241329',
  minion: '#2a1410',
};

/** La pièce de chaque blason, centrée en (60, 96) puis agrandie sur l'écu. */
function Charge({ role }: { role: Role | null }) {
  const s = { stroke: FIL, strokeWidth: 2.4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  switch (role) {
    case 'merlin':
      return (
        <g {...s}>
          <polygon points={star(60, 94, 27, 10, 8)} fill={OR} />
          <polygon points={star(60, 94, 11, 4.4, 4, -45)} fill={SEMIS} strokeWidth={1.8} />
          <polygon points={star(32, 70, 6, 2.4, 4)} fill={ARGENT} strokeWidth={1.2} />
          <polygon points={star(88, 70, 6, 2.4, 4)} fill={ARGENT} strokeWidth={1.2} />
        </g>
      );
    case 'perceval':
      return (
        <g {...s}>
          <path d="M51 44 H69 V84 H110 V104 H69 V150 H51 V104 H10 V84 H51 Z" fill={ARGENT} />
          <polygon points={star(60, 94, 9, 3.6, 4)} fill={OR} strokeWidth={1.6} />
        </g>
      );
    case 'servant':
      return (
        <g {...s}>
          <path d="M40 66 H80 Q80 97 60 101 Q40 97 40 66 Z" fill={OR} />
          <path d="M44 74 H76" stroke={GUEULES} strokeWidth={4} />
          <path d="M56 101 H64 V116 H56 Z" fill={OR} />
          <path d="M42 128 Q60 112 78 128 Z" fill={OR} />
        </g>
      );
    case 'assassin':
      return (
        <g {...s}>
          <path d="M60 56 L69 99 L60 110 L51 99 Z" fill={ARGENT} />
          <path d="M60 62 V104" stroke="#8e8d8a" strokeWidth={1.4} />
          <path d="M42 107 H78 V114 H42 Z" fill={OR} />
          <path d="M56 114 H64 V127 H56 Z" fill="#7a4a2a" />
          <circle cx="60" cy="132" r="5" fill={OR} />
        </g>
      );
    case 'morgane':
      return (
        <g {...s}>
          <path d="M72 62 A34 34 0 1 0 72 128 A27 27 0 1 1 72 62 Z" fill={ARGENT} />
          <polygon points={star(78, 88, 11, 4, 4)} fill={OR} strokeWidth={1.6} />
        </g>
      );
    case 'mordred':
      return (
        <g {...s}>
          <path d="M34 122 L38 76 L50 95 L60 64 L70 95 L82 76 L86 122 Z" fill={OR} />
          <path d="M34 122 H86 V132 H34 Z" fill="#a87a1c" />
          <path d="M61 66 L56 88 L65 99 L57 122" fill="none" stroke={FIL} strokeWidth={3} />
          <circle cx="44" cy="127" r="2.6" fill={GUEULES} strokeWidth={1.2} />
          <circle cx="76" cy="127" r="2.6" fill={GUEULES} strokeWidth={1.2} />
        </g>
      );
    case 'oberon':
      return (
        <g {...s}>
          <path d="M60 58 Q90 68 90 106 L84 132 H36 L30 106 Q30 68 60 58 Z" fill="#6a3a80" />
          <ellipse cx="60" cy="100" rx="15" ry="19" fill="#0e0810" strokeWidth={2} />
          <circle cx="54" cy="97" r="2.8" fill="#ff8a70" stroke="none" />
          <circle cx="66" cy="97" r="2.8" fill="#ff8a70" stroke="none" />
        </g>
      );
    case 'minion':
      return (
        <g {...s}>
          <path d="M55 80 H65 V120 L60 132 L55 120 Z" fill={ARGENT} />
          <path d="M40 72 H80 V80 H40 Z" fill={OR} />
          <path d="M56 58 H64 V72 H56 Z" fill="#7a4a2a" />
          <circle cx="60" cy="54" r="5" fill={OR} />
        </g>
      );
    default:
      return <Flower x={60} y={95} r={15} fill={SEMIS} stroke={FIL} />;
  }
}

const SHIELD = 'M6 5 H114 V70 Q114 112 60 136 Q6 112 6 70 Z';

/**
 * L'écu d'un rôle : la bordure dit le camp, le champ et la pièce disent le rôle.
 * Sans rôle, c'est le revers : un écu de laine verte identique pour tout le monde.
 */
export function RoleBlazon({ role, className }: { role: Role | null; className?: string }) {
  const id = useId().replace(/:/g, '');
  const side = role ? SIDE[role] : null;
  const border = side === 'good' ? OR : side === 'evil' ? '#c8402c' : '#1f463e';
  const inner = 'translate(60 66) scale(0.84) translate(-60 -66)';
  return (
    <svg viewBox="0 0 120 142" className={cls('blazon', side && `is-${side}`, className)} aria-hidden>
      <defs>
        <clipPath id={`champ${id}`}>
          <path d={SHIELD} transform={inner} />
        </clipPath>
        <pattern id={`trame${id}`} width="3" height="3" patternUnits="userSpaceOnUse">
          <rect width="3" height="1" fill="#000" opacity="0.1" />
        </pattern>
      </defs>
      <path d={SHIELD} fill={border} stroke={FIL} strokeWidth="4" strokeLinejoin="round" />
      <g clipPath={`url(#champ${id})`}>
        <rect width="120" height="142" fill={role ? FIELD[role] : VERDURE} />
        {role === 'minion' && <path d="M0 0 L120 142 H0 Z" fill="#6e1a12" />}
        {!role && (
          <g stroke={SEMIS} strokeWidth="1" opacity="0.32">
            {Array.from({ length: 9 }, (_, i) => (
              <path key={i} d={`M${i * 30 - 60} 0 L${i * 30 + 60} 142 M${i * 30 + 60} 0 L${i * 30 - 60} 142`} />
            ))}
          </g>
        )}
        <g transform="translate(60 62) scale(1.02) translate(-60 -96)">
          <Charge role={role} />
        </g>
        <rect width="120" height="142" fill={`url(#trame${id})`} />
      </g>
      <path d={SHIELD} transform={inner} fill="none" stroke={FIL} strokeWidth="1.8" strokeLinejoin="round" />
      <path d={SHIELD} transform="translate(60 66) scale(0.925) translate(-60 -66)" fill="none" stroke={side ? FIL : SEMIS} strokeOpacity={side ? 0.55 : 0.7} strokeWidth="1.4" strokeDasharray="4 3" strokeLinecap="round" />
    </svg>
  );
}

/** La scène de l'accueil : Excalibur plantée dans sa pierre, sur l'île bleue de la tapisserie, entre deux arbres. */
export function HeroScene({ className }: { className?: string }) {
  const tree = (x: number, leaf: string, fruit: string, flip: number) => (
    <g>
      <path d={`M${x - 4} 134 Q${x - 2} 100 ${x - 3} 78 H${x + 3} Q${x + 2} 100 ${x + 4} 134 Z`} fill="#6b4426" stroke={FIL} strokeWidth="1.6" />
      <g fill={leaf} stroke={FIL} strokeWidth="1.6">
        <circle cx={x - 18 * flip} cy="70" r="15" />
        <circle cx={x + 18 * flip} cy="66" r="16" />
        <circle cx={x} cy="44" r="19" />
        <circle cx={x - 15 * flip} cy="50" r="13" />
        <circle cx={x + 16 * flip} cy="46" r="12" />
        <circle cx={x} cy="66" r="17" />
      </g>
      <g fill={fruit} stroke={FIL} strokeWidth="1">
        <circle cx={x - 20 * flip} cy="66" r="3" />
        <circle cx={x + 14 * flip} cy="72" r="3" />
        <circle cx={x + 3} cy="40" r="3" />
        <circle cx={x - 12 * flip} cy="46" r="3" />
        <circle cx={x + 20 * flip} cy="48" r="3" />
        <circle cx={x - 3} cy="62" r="3" />
      </g>
    </g>
  );
  return (
    <svg viewBox="0 0 280 196" className={cls('hero-art', className)} aria-hidden>
      <ellipse cx="140" cy="148" rx="136" ry="45" fill={AZUR} stroke={FIL} strokeWidth="3" />
      <ellipse cx="140" cy="148" rx="129" ry="39" fill="none" stroke={SEMIS} strokeOpacity="0.7" strokeWidth="1.5" strokeDasharray="5 4" strokeLinecap="round" />
      {tree(46, '#3f7d58', OR, 1)}
      {tree(234, '#2f6a58', '#e8735c', -1)}
      <Flower x={92} y={172} r={4.4} fill={SEMIS} />
      <Flower x={186} y={174} r={4.4} fill="#f3a899" />
      <Flower x={140} y={181} r={3.8} fill={OR} core={SEMIS} />
      <Flower x={84} y={128} r={3.4} fill="#f3a899" />
      <Flower x={196} y={126} r={3.4} fill={SEMIS} />
      <path d="M106 166 Q100 140 116 130 Q140 120 164 130 Q180 140 174 166 Q140 176 106 166 Z" fill="#a89c88" stroke={FIL} strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M116 131 Q140 121 164 131 Q156 145 140 145 Q124 145 116 131 Z" fill="#cfc5b1" stroke={FIL} strokeWidth="1.6" strokeLinejoin="round" />
      <ellipse cx="140" cy="134" rx="11" ry="3.4" fill="#3a3028" />
      <g className="hero-sword">
        <path d="M133 44 H147 V135 H133 Z" fill="#e6e9ee" stroke={FIL} strokeWidth="2.4" strokeLinejoin="round" />
        <path d="M140 46 V134" stroke="#9aa2ad" strokeWidth="2" />
        <rect x="136" y="16" width="8" height="22" fill="#6e1a12" stroke={FIL} strokeWidth="2" />
        <rect x="114" y="36" width="52" height="9" rx="4" fill={OR} stroke={FIL} strokeWidth="2.4" />
        <circle cx="140" cy="12" r="8" fill={OR} stroke={FIL} strokeWidth="2.4" />
        <circle cx="140" cy="12" r="3" fill={GUEULES} />
      </g>
    </svg>
  );
}

/** Un médaillon de quête : la taille de l'équipe, et le résultat une fois la quête jouée. */
export function QuestMedal({ size, needed, result, current }: { size: number; needed: number; result: Card | null; current?: boolean }) {
  return (
    <div className={cls('medal', result && `is-${result}`, current && 'is-current')}>
      <svg viewBox="0 0 60 60" aria-hidden>
        <circle cx="30" cy="30" r="27" className="medal-cloth" stroke={FIL} strokeWidth="3" />
        <circle cx="30" cy="30" r="22.5" fill="none" className="medal-ring" strokeWidth="1.5" strokeDasharray="3.4 2.6" strokeLinecap="round" />
        {result === 'success' && (
          <g stroke={FIL} strokeWidth="2.2" strokeLinejoin="round">
            <path d="M19 17 H41 Q41 33 30 35 Q19 33 19 17 Z" fill={AZUR} />
            <path d="M28 35 H32 V41 H28 Z" fill={AZUR} />
            <path d="M20 47 Q30 39 40 47 Z" fill={AZUR} />
          </g>
        )}
        {result === 'fail' && (
          <g stroke={FIL} strokeWidth="2.2" strokeLinejoin="round">
            <path d="M30 11 L36 34 L30 40 L24 34 Z" fill={ARGENT} />
            <path d="M20 38 H40 V42.5 H20 Z" fill={OR} />
            <path d="M28 42.5 H32 V49 H28 Z" fill="#7a4a2a" />
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

/** Un bulletin de vote : un soleil d'or pour, un sautoir sur gueules contre. */
export function Ballot({ yes, className }: { yes: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cls('ballot', yes ? 'is-yes' : 'is-no', className)} aria-label={yes ? 'Pour' : 'Contre'} role="img">
      {yes ? (
        <g stroke={FIL} strokeWidth="2.2" strokeLinejoin="round">
          <polygon points={star(20, 20, 18.5, 11, 12)} fill={OR} />
          <circle cx="20" cy="20" r="8.5" fill="#fff0c2" />
        </g>
      ) : (
        <g stroke={FIL} strokeWidth="2.2" strokeLinejoin="round">
          <circle cx="20" cy="20" r="17.5" fill={GUEULES} />
          <path d="M12.5 12.5 L27.5 27.5 M27.5 12.5 L12.5 27.5" stroke={ARGENT} strokeWidth="4.4" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}

/** Une carte de quête en étoffe : Réussite (un calice) ou Échec (une dague). */
export function QuestCard({ card, className }: { card: Card | null; className?: string }) {
  const id = useId().replace(/:/g, '');
  const field = card === null ? VERDURE : card === 'success' ? AZUR : GUEULES;
  const good = card === 'success';
  return (
    <svg viewBox="0 0 100 140" className={cls('quest-card', card && `is-${card}`, className)} aria-hidden>
      <defs>
        <pattern id={`qc${id}`} width="3" height="3" patternUnits="userSpaceOnUse">
          <rect width="3" height="1" fill="#000" opacity="0.1" />
        </pattern>
        <clipPath id={`qcc${id}`}>
          <rect x="3" y="3" width="94" height="134" rx="9" />
        </clipPath>
      </defs>
      <rect x="3" y="3" width="94" height="134" rx="9" fill={field} stroke={FIL} strokeWidth="3.4" />
      <g clipPath={`url(#qcc${id})`}>
        {card === null && (
          <g stroke={SEMIS} strokeWidth="1" opacity="0.3">
            {Array.from({ length: 8 }, (_, i) => (
              <path key={i} d={`M${i * 28 - 56} 0 L${i * 28 + 44} 140 M${i * 28 + 44} 0 L${i * 28 - 56} 140`} />
            ))}
          </g>
        )}
        <circle cx="50" cy="70" r="33" fill={card === null ? 'none' : good ? '#14305f' : '#6e1a12'} stroke={card === null ? 'none' : OR} strokeWidth="2" />
        <g stroke={FIL} strokeWidth="2.6" strokeLinejoin="round">
          {card === 'success' && (
            <>
              <path d="M32 48 H68 Q68 75 50 78 Q32 75 32 48 Z" fill={OR} />
              <path d="M46.5 78 H53.5 V89 H46.5 Z" fill={OR} />
              <path d="M34 98 Q50 86 66 98 Z" fill={OR} />
              <path d="M37 55 H63" stroke={GUEULES} strokeWidth="3" />
            </>
          )}
          {card === 'fail' && (
            <>
              <path d="M50 40 L58 76 L50 85 L42 76 Z" fill={ARGENT} />
              <path d="M34 83 H66 V89 H34 Z" fill={OR} />
              <path d="M46.5 89 H53.5 V99 H46.5 Z" fill="#7a4a2a" />
              <circle cx="50" cy="102.5" r="4" fill={OR} />
            </>
          )}
        </g>
        {card === null && <Flower x={50} y={70} r={13} fill={SEMIS} stroke={FIL} />}
        <rect width="100" height="140" fill={`url(#qc${id})`} />
      </g>
      <rect x="8.5" y="8.5" width="83" height="123" rx="5" fill="none" stroke={SEMIS} strokeOpacity="0.75" strokeWidth="1.4" strokeDasharray="4 3" strokeLinecap="round" />
    </svg>
  );
}

/** La couronne du meneur. */
export function CrownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 24" className={cls('crown-icon', className)} aria-hidden>
      <path d="M3 20 L5 6 L11 13 L16 3 L21 13 L27 6 L29 20 Z" fill={OR} stroke={FIL} strokeWidth="2.2" strokeLinejoin="round" />
      <circle cx="16" cy="15" r="2.2" fill={GUEULES} stroke={FIL} strokeWidth="1.4" />
    </svg>
  );
}

/** L'écu des chevaliers choisis pour la quête. */
export function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 28" className={cls('shield-icon', className)} aria-hidden>
      <path d="M3 3 H21 V13 Q21 22 12 26 Q3 22 3 13 Z" fill={AZUR} stroke={FIL} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M10.5 6 H13.5 V11 H18 V14 H13.5 V22 H10.5 V14 H6 V11 H10.5 Z" fill={OR} stroke={FIL} strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

/** La Dame du Lac : une goutte d'eau claire. */
export function LadyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 28" className={cls('lady-icon', className)} aria-hidden>
      <path d="M12 2 Q21 14 21 18 A9 9 0 0 1 3 18 Q3 14 12 2 Z" fill="#6cc7dd" stroke={FIL} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M8 18 A4 4 0 0 0 12 22" fill="none" stroke="#e8fbff" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
