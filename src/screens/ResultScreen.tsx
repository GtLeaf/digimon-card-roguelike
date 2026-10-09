import { ArrowRight, ScanLine } from 'lucide-react';
import { FORM_NAMES } from '../game/data';
import type { Run } from '../game/types';
import { Sprite } from '../components/Sprite';

export function ResultScreen({
  run,
  onHome,
  onCollection,
}: {
  run: Run;
  onHome: () => void;
  onCollection: () => void;
}) {
  const r = run;
  return (
    <div className="choice-screen final-screen">
      <span className="eyebrow">
        {r.won ? 'UNTIL OUR NEXT ADVENTURE' : 'THE SIGNAL NEVER FADES'}
      </span>
      <h1>{r.won ? '旅途终点，也是起点。' : '这一次，先休息吧。'}</h1>
      <Sprite id={r.form} size={270} />
      <h2>{FORM_NAMES[r.form]}</h2>
      <p>
        {r.won
          ? '你们守住了最后的信号。下一次，会选择不同的进化吗？'
          : '搭档的故事还会继续。已获取的扫描数据与伙伴不会丢失。'}
      </p>
      <div className="run-summary">
        <span>
          <b>{r.won ? r.nodes.length : r.row + 1}</b>探索节点
        </span>
        <span>
          <b>{r.kills}</b>击败敌人
        </span>
        <span>
          <b>{r.damageDealt}</b>累计伤害
        </span>
      </div>
      <button className="primary" onClick={onHome}>
        开启下一段旅途
        <ArrowRight size={17} />
      </button>
      <button className="text-btn" onClick={onCollection}>
        看看这次收集的伙伴
        <ScanLine size={15} />
      </button>
    </div>
  );
}
