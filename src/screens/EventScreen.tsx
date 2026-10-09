import { ArrowRight, Heart, Radio, ScanLine, Zap } from 'lucide-react';
import { eventFor } from '../game/events';
import type { Action, Meta, Run } from '../game/types';
import { StoryEventView } from '../components/StoryEvent';

export function EventScreen({
  run,
  meta,
  send,
}: {
  run: Run;
  meta: Meta;
  send: (action: Action) => void;
}) {
  const r = run;
  if (eventFor(r))
    return <StoryEventView key={r.currentNode?.id} run={r} meta={meta} onAction={send} />;
  return (
    <div className="choice-screen event-screen">
      <Radio className="large-icon" />
      <span className="eyebrow">AN UNEXPECTED SIGNAL</span>
      <h1>废墟里的一束光。</h1>
      <div className="event-illustration">
        <ScanLine size={64} />
        <span>DATA RECOVERY / 68%</span>
      </div>
      <p className="story-text">
        一台损坏的读卡器仍在发出微弱信号。
        <br />
        搭档看向你。你们可以修复它，也可以在这里短暂休息。
      </p>
      <div className="option-list">
        <button className="option" onClick={() => send({ type: 'event', choice: 'risk' })}>
          <Zap />
          <span>
            <strong>尝试修复</strong>
            <small>失去 8 生命（最低保留 1），获得 35 金币，强化一张未强化的非防御插件牌。</small>
          </span>
          <ArrowRight />
        </button>
        <button className="option" onClick={() => send({ type: 'event', choice: 'safe' })}>
          <Heart />
          <span>
            <strong>{Math.floor(r.row / r.chapterRows) === 1 ? '休息与研究' : '一起休息'}</strong>
            <small>
              回复 10 生命。
              {Math.floor(r.row / r.chapterRows) === 1
                ? '研究并净化信号，永久解锁净化资料与机械研究。'
                : ''}
            </small>
          </span>
          <ArrowRight />
        </button>
      </div>
    </div>
  );
}
