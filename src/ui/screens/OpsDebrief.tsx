import type { ReactNode } from 'react';
import { useGame } from '../store';
import { pendingDebrief } from '../../sim/operation-selectors';
import type { DebriefResult } from '../../sim/types';
import { BeforeAfter, Button, Card, Chip, Meter, SubHead } from '../components/ui';
import { useToast } from '../components/toast';
import { ITEMS } from '../../content/items';
import { Icon, itemIcon } from '../icons';
import type { IconName } from '../icons';
import { signed, signedMoney } from '../format';

export function OpsDebrief() {
  const g = useGame();
  const { act } = useToast();
  const d = pendingDebrief(g);
  const close = () => act({ type: 'closeDebrief' });
  if (!d) {
    return (
      <div className="page">
        <Card>
          <h2 className="section-title">Debrief</h2>
          <p className="dim">The operation is over. The debrief is not available yet.</p>
          <Button variant="primary" block onClick={close}>
            Close
          </Button>
        </Card>
      </div>
    );
  }
  return (
    <div className="page debrief">
      <div className="debrief-hero">
        <span className="kicker">{d.practice ? 'PRACTICE DEBRIEF' : 'DEBRIEF'}</span>
        <h2 className="debrief-title">{d.endingTitle}</h2>
        {d.practice && (
          <p className="note note-amber">
            <Icon name="info" size={16} />
            Practice run: no rewards, no stress, no supplies or reputation consequences.
          </p>
        )}
      </div>
      <Rows d={d} officers={g.officers} />
      {d.causes.length > 0 && (
        <Card>
          <SubHead icon="list">What decided it</SubHead>
          <ol className="causes">
            {d.causes.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ol>
        </Card>
      )}
      <div className="stickyfoot">
        <Button variant="primary" block onClick={close}>
          Close debrief
        </Button>
      </div>
    </div>
  );
}

function Row({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <section className="drow">
      <h3 className="drow-h">
        <Icon name={icon} size={18} />
        {title}
      </h3>
      <div className="drow-body">{children}</div>
    </section>
  );
}

function Rows({ d, officers }: { d: DebriefResult; officers: Record<string, { surname: string; firstName: string }> }) {
  const tone = (n: number) => (n >= 70 ? 'hi' : n >= 40 ? 'mid' : 'lo');
  return (
    <Card className="drows">
      <Row icon="flag" title="Objective">
        <div className="drow-meter">
          <strong>{d.objective.label}</strong>
          <Meter value={d.objective.score} tone={tone(d.objective.score)} label="Objective" valueText={`${Math.round(d.objective.score)} of 100`} />
          <span className="dim">{Math.round(d.objective.score)}/100</span>
        </div>
      </Row>
      <Row icon="civilian" title="Civilian safety">
        <div className="drow-meter">
          <strong>{d.civilianSafety.label}</strong>
          <Meter value={d.civilianSafety.score} tone={tone(d.civilianSafety.score)} label="Civilian safety" valueText={`${Math.round(d.civilianSafety.score)} of 100`} />
          <span className="dim">{Math.round(d.civilianSafety.score)}/100</span>
        </div>
      </Row>
      <Row icon="pulse" title="Officer condition">
        {d.officerCondition.length === 0 ? (
          <span className="dim">No officers deployed.</span>
        ) : (
          <ul className="offrows">
            {d.officerCondition.map((o) => {
              const off = officers[o.officerId];
              const delta = o.stressAfter - o.stressBefore;
              return (
                <li key={o.officerId}>
                  <strong>
                    <Icon name="user" size={14} />
                    {off ? off.surname : o.officerId}
                  </strong>
                  <span>
                    Stress {Math.round(o.stressBefore)} {'→'} {Math.round(o.stressAfter)}{' '}
                    <b className={delta > 0 ? 'tone-danger' : delta < 0 ? 'tone-mint' : ''}>({signed(delta)})</b>
                  </span>
                  <span className="dim">+{Math.round(o.xpGained)} xp</span>
                </li>
              );
            })}
          </ul>
        )}
      </Row>
      <Row icon="intel" title="Information preserved">
        {d.informationPreserved.length === 0 ? (
          <span className="dim">Nothing recorded.</span>
        ) : (
          <ul className="offrows">
            {d.informationPreserved.map((f) => (
              <li key={f.factId}>
                <strong>{f.label}</strong>
                <span>
                  {f.status === 'confirmed' ? (
                    <Chip tone="mint" icon="check">
                      Confirmed
                    </Chip>
                  ) : f.status === 'disproved' ? (
                    <Chip tone="danger" icon="x">
                      Disproved
                    </Chip>
                  ) : (
                    <Chip tone="amber" icon="question">
                      {f.status === 'reported' ? 'Reported' : 'Unknown'}
                    </Chip>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Row>
      <Row icon="box" title="Resources">
        {d.resources.length === 0 ? (
          <span className="dim">No equipment was carried.</span>
        ) : (
          <ul className="offrows">
            {d.resources.map((r) => (
              <li key={r.itemId}>
                <strong>
                  <Icon name={itemIcon(r.itemId)} size={15} />
                  {ITEMS[r.itemId]?.name ?? r.itemId}
                </strong>
                <span>
                  Used {r.used} · returned {r.returned}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Row>
      <Row icon="wrench" title="Equipment wear">
        {(d.unitWear ?? []).length === 0 ? (
          <span className="dim">No equipment wore down on this run.</span>
        ) : (
          <ul className="wearrows">
            {d.unitWear.map((w) => {
              const delta = w.after - w.before;
              return (
                <li key={w.unitId}>
                  <span className="wear-id">
                    <Icon name={itemIcon(w.itemId)} size={15} />
                    <strong>{w.serial}</strong>
                    <span className="dim">{ITEMS[w.itemId]?.name ?? w.itemId}</span>
                  </span>
                  <span className="wear-nums">
                    {Math.round(w.before)}% <Icon name="arrowRight" size={12} /> {Math.round(w.after)}%{' '}
                    <b className={delta < 0 ? 'tone-warn' : delta > 0 ? 'tone-mint' : ''}>({signed(delta)})</b>
                  </span>
                  <BeforeAfter before={w.before} after={w.after} />
                </li>
              );
            })}
          </ul>
        )}
      </Row>
      <Row icon="cash" title="Rewards">
        {d.practice ? (
          <span className="dim">None. Practice runs grant no rewards.</span>
        ) : (
          <div className="chips">
            <Chip tone="mint" icon="cash">
              Funding {signedMoney(d.fundingReward)}
            </Chip>
            <Chip tone={d.trustDelta < 0 ? 'danger' : 'mint'} icon="shield">
              Trust {signed(d.trustDelta)}
            </Chip>
            <Chip tone="amber" icon="chart">
              {d.devPointReward} dev point{d.devPointReward === 1 ? '' : 's'}
            </Chip>
          </div>
        )}
      </Row>
    </Card>
  );
}
