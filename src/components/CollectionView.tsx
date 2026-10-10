import { Check, GitBranch, Lock, Shield } from 'lucide-react';
import { ENEMIES, FORM_NAMES, asset } from '../game/data';
import { EVOLUTIONS, stageName } from '../game/evolution';
import type { Action, Meta, Run } from '../game/types';
import { AttributeLabel } from './AttributeLabel';

export function CollectionView({
  run,
  meta,
  send,
  onTree,
}: {
  run: Run | null;
  meta: Meta;
  send: (action: Action) => void;
  onTree: () => void;
}) {
  const r = run;
  return (
    <>
      <details className="partner-codex">
        <summary>搭档形态 · {Object.keys(EVOLUTIONS).length} 种</summary>
        <p className="modal-note">
          三位初始搭档直接可选；小妖兽在别西卜兽扫描率达 100%
          后解锁。进化形态通过本局成长获得。扫描用于支援伙伴与跨局路线研究。
        </p>
        <div className="collection-grid">
          {Object.values(EVOLUTIONS).map((form) => (
            <div className="collection-item" key={form.id}>
              <img src={asset(form.id)} alt={FORM_NAMES[form.id]} />
              <h3>{FORM_NAMES[form.id]}</h3>
              <span>
                {stageName(form.stage)} · <AttributeLabel id={form.id} compact />
              </span>
              <p>
                {form.stage === 0
                  ? '初始搭档 · 可直接选择'
                  : meta.discovered.includes(form.id) || r?.formHistory.includes(form.id)
                    ? '已到达此形态'
                    : '等待进化探索'}
              </p>
            </div>
          ))}
        </div>
        <button className="secondary" onClick={onTree}>
          查看进化路线
          <GitBranch size={16} />
        </button>
      </details>
      <p className="modal-note">
        战胜普通／精英数码兽＋50% 扫描。九个支援伙伴达到 100%
        即可转化（黑大耳兽通过救援事件获得）；每场支援一次，战斗外可更换。
      </p>
      {r && (
        <button
          className={`option ${r.support === 'default' ? 'chosen' : ''}`}
          disabled={r.screen === 'battle'}
          onClick={() => send({ type: 'equip', id: 'default' })}
        >
          <Shield />
          <span>
            <strong>应急防御程序</strong>
            <small>获得 8 护盾；每次使用后需抵达休息营地恢复。</small>
          </span>
          {r.support === 'default' ? <Check /> : <span>装备</span>}
        </button>
      )}
      <div className="collection-grid">
        {Object.values(ENEMIES)
          .filter((e) => e.scan)
          .map((e) => {
            const progress = meta.scans[e.id] ?? 0;
            const owned = meta.partners.includes(e.id);
            return (
              <div className={`collection-item ${progress === 0 ? 'undiscovered' : ''}`} key={e.id}>
                <img src={asset(e.id)} alt={e.name} />
                <h3>{e.name}</h3>
                {progress > 0 && <AttributeLabel id={e.id} />}
                <span>
                  {progress}% <small>{e.support ? '支援伙伴' : '资料图鉴'}</small>
                </span>
                <progress max={100} value={progress} />
                <p>{e.support ?? '收集战斗资料，记录你们的相遇。'}</p>
                {e.support &&
                  (owned ? (
                    <button
                      className="secondary"
                      disabled={!r || r.screen === 'battle' || r.support === e.id}
                      onClick={() => send({ type: 'equip', id: e.id })}
                    >
                      {r?.support === e.id
                        ? '已装备'
                        : r?.screen === 'battle'
                          ? '战斗后可更换'
                          : '装备支援'}
                    </button>
                  ) : (
                    <button
                      className="secondary"
                      disabled={progress < 100}
                      onClick={() => send({ type: 'convert', id: e.id })}
                    >
                      {progress < 100 ? (
                        <>
                          <Lock size={13} />
                          扫描未完成
                        </>
                      ) : (
                        '转化伙伴'
                      )}
                    </button>
                  ))}
              </div>
            );
          })}
        <div className="collection-item">
          <img src={asset('lopmon')} alt="黑大耳兽" />
          <h3>黑大耳兽</h3>
          <AttributeLabel id="lopmon" />
          <span>
            <small>救援事件伙伴</small>
          </span>
          <p>安慰之光：清除手牌中 1 张故障牌；没有故障牌时回复 6 生命。</p>
          {meta.partners.includes('lopmon') ? (
            r ? (
              <button
                className="secondary"
                disabled={r.screen === 'battle' || r.support === 'lopmon'}
                onClick={() => send({ type: 'equip', id: 'lopmon' })}
              >
                {r.support === 'lopmon'
                  ? '已装备'
                  : r.screen === 'battle'
                    ? '战斗后可更换'
                    : '装备支援'}
              </button>
            ) : null
          ) : (
            <span className="scan-note">救援事件中获得</span>
          )}
        </div>
      </div>
    </>
  );
}
