// Les règles, lisibles en trois minutes et consultables à tout moment.
import { Crown, Droplets, Eye, Swords, Users, Vote } from 'lucide-react';
import { QUEST_SIZES, type Role } from '../../../shared/protocol';
import { ROLE_TEXT, roleName } from '../lib/text';
import { useStore } from '../store';
import { Ballot, QuestCard, RoleWindow } from './Art';
import { Modal } from './Ui';

const GOOD_ROLES: Role[] = ['merlin', 'perceval', 'servant'];
const EVIL_ROLES: Role[] = ['assassin', 'morgane', 'mordred', 'oberon', 'minion'];

function RoleLine({ role }: { role: Role }) {
  return (
    <li className="rule-role">
      <RoleWindow role={role} className="rule-role-art" />
      <div>
        <b>{roleName(role)}</b>
        <span>{ROLE_TEXT[role]}</span>
      </div>
    </li>
  );
}

export function RulesModal() {
  const open = useStore((s) => s.rulesOpen);
  const setOpen = useStore((s) => s.setRulesOpen);
  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Les règles" wide>
      <div className="rules">
        <section className="rule-hero">
          <div className="rule-fan" aria-hidden>
            <RoleWindow role="merlin" />
            <RoleWindow role={null} />
            <RoleWindow role="assassin" />
          </div>
          <p>
            Deux camps s'affrontent en secret. Les <b className="t-good">loyaux d'Arthur</b> doivent réussir <b>trois quêtes</b>. Les <b className="t-evil">sbires de Mordred</b>, cachés parmi eux, doivent en faire échouer trois. Personne ne sait qui est qui… sauf le Mal, qui se connaît.
          </p>
        </section>

        <section>
          <h3>Chaque quête, en trois temps</h3>
          <ul className="rule-actions">
            <li>
              <Crown size={20} aria-hidden />
              <div>
                <b>Le meneur compose l'équipe</b> : autant de chevaliers que le médaillon de la quête l'indique. Tout le monde voit l'équipe se former, et chacun peut donner son avis.
              </div>
            </li>
            <li>
              <Vote size={20} aria-hidden />
              <div>
                <b>Tout le monde vote</b>, en secret, pour ou contre cette équipe. Les votes se retournent ensemble. Plus de la moitié de « pour » : l'équipe part. Sinon, le meneur suivant propose la sienne.
                <span className="rule-ballots">
                  <Ballot yes /> pour <Ballot yes={false} /> contre
                </span>
              </div>
            </li>
            <li>
              <Swords size={20} aria-hidden />
              <div>
                <b>L'équipe joue une carte en secret.</b> Un loyal joue toujours Réussite ; un sbire choisit. Les cartes sont mélangées puis retournées : une seule carte Échec et la quête échoue (à partir de 7 joueurs, il en faut deux à la 4e quête).
                <span className="rule-cards">
                  <QuestCard card="success" /> <QuestCard card="fail" />
                </span>
              </div>
            </li>
          </ul>
        </section>

        <section className="rule-split">
          <div className="rule-case">
            <h3>
              <Users size={18} aria-hidden /> Cinq rejets
            </h3>
            <p>Si cinq équipes de suite sont rejetées pour la même quête, le Mal gagne : le royaume sombre dans la discorde.</p>
          </div>
          <div className="rule-case">
            <h3>
              <Eye size={18} aria-hidden /> L'assassinat
            </h3>
            <p>Si le Bien réussit trois quêtes, l'Assassin a une dernière chance : désigner Merlin. S'il vise juste, le Mal gagne quand même.</p>
          </div>
        </section>

        <section>
          <h3>Les rôles</h3>
          <ul className="rule-roles is-good">
            {GOOD_ROLES.map((r) => (
              <RoleLine key={r} role={r} />
            ))}
          </ul>
          <ul className="rule-roles is-evil">
            {EVIL_ROLES.map((r) => (
              <RoleLine key={r} role={r} />
            ))}
          </ul>
          <p className="muted small">Merlin et l'Assassin sont toujours là. Perceval et Morgane, Mordred et Oberon s'ajoutent dans les réglages du salon.</p>
        </section>

        <section>
          <h3>
            <Droplets size={18} aria-hidden /> La Dame du Lac (en option)
          </h3>
          <p>Après les quêtes 2, 3 et 4, celui qui la tient découvre en secret le camp d'un joueur, puis la lui confie. On ne peut pas sonder quelqu'un qui l'a déjà tenue. Ce qu'on en dit ensuite est libre… vrai ou faux.</p>
        </section>

        <section>
          <h3>Équipes et camps</h3>
          <div className="rule-table" role="table" aria-label="Taille des équipes par quête">
            <div role="row" className="rule-row is-head">
              <span role="columnheader">Joueurs</span>
              <span role="columnheader">Mal</span>
              {[1, 2, 3, 4, 5].map((q) => (
                <span key={q} role="columnheader">
                  Q{q}
                </span>
              ))}
            </div>
            {[5, 6, 7, 8, 9, 10].map((n) => (
              <div key={n} role="row" className="rule-row">
                <span role="cell">{n}</span>
                <span role="cell">{({ 5: 2, 6: 2, 7: 3, 8: 3, 9: 3, 10: 4 } as Record<number, number>)[n]}</span>
                {QUEST_SIZES[n].map((s, q) => (
                  <span key={q} role="cell">
                    {s}
                    {n >= 7 && q === 3 ? '*' : ''}
                  </span>
                ))}
              </div>
            ))}
          </div>
          <p className="muted small">* deux cartes Échec pour faire échouer cette quête.</p>
        </section>

        <section className="rule-memory">
          <h3>Dans cette version</h3>
          <ul>
            <li>On débat à voix haute, autour d'une table ou en appel. L'hôte peut aussi choisir une discussion par écrit.</li>
            <li>Les votes se lisent pendant quelques secondes, puis disparaissent : aucun historique n'est gardé. Retiens qui a voté quoi !</li>
            <li>Un joueur absent plus de 20 secondes est remplacé par le pilote automatique jusqu'à son retour.</li>
          </ul>
        </section>

        <p className="rule-foot">
          D'après <i>The Resistance : Avalon</i>, le jeu de Don Eskridge (Indie Boards &amp; Cards). Création de fans, non officielle, avec ses propres visuels.
        </p>
      </div>
    </Modal>
  );
}
