import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Shield } from 'lucide-react';
import { ENEMIES, asset } from '../game/data';
import type { SupportCutInState } from '../hooks/useBattleQueue';
import './SupportCutIn.css';

const QUOTES: Record<string, string> = {
  leomon: '别害怕，我与你并肩！',
  hagurumon: '防线展开，我来守住！',
  mushmon: '嘿嘿，尝尝我的孢子！',
  picodevimon: '看我的，别眨眼！',
  impmon: '这次，让我来露一手！',
  andromon: '防御矩阵，启动！',
  gotsumon: '给你力量，继续进攻！',
  betamon: '别急，还有新的办法！',
  lopmon: '别怕，我会治好你的！',
  keramon: '嘿嘿，数据已接通！',
};
const HOLD_MS = 1500;
const ENTRANCE_MS = 350;

export function SupportCutIn({
  cutIn,
  onComplete,
}: {
  cutIn: SupportCutInState;
  onComplete: (key: number) => void;
}) {
  const ribbon = useRef<HTMLDivElement>(null);
  const portrait = useRef<HTMLDivElement>(null);
  const dialogue = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const completed = useRef<number | null>(null);
  const name = ENEMIES[cutIn.partner]?.name ?? '应急防御程序';
  const quote = QUOTES[cutIn.partner] ?? '防御程序已启动。';
  const hasPortrait = !!ENEMIES[cutIn.partner];
  const finish = useCallback(() => {
    if (completed.current === cutIn.key) return;
    completed.current = cutIn.key;
    onComplete(cutIn.key);
  }, [cutIn.key, onComplete]);

  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    const animations: Animation[] = [];
    const hold = () => {
      if (active) timer = window.setTimeout(finish, HOLD_MS);
    };
    if (cutIn.reducedMotion) hold();
    else {
      const timing = { duration: ENTRANCE_MS, fill: 'both' as const };
      animations.push(
        ribbon.current!.animate(
          [{ transform: 'translateX(-110%)' }, { transform: 'translateX(0)' }],
          { ...timing, easing: 'cubic-bezier(.22,.7,.2,1)' },
        ),
        portrait.current!.animate(
          [{ transform: 'translateX(-28px) scale(1.05)' }, { transform: 'translateX(0) scale(1)' }],
          timing,
        ),
        dialogue.current!.animate(
          [
            { opacity: 0, transform: 'translateX(18px)' },
            { opacity: 1, transform: 'translateX(0)' },
          ],
          { ...timing, delay: 120, duration: ENTRANCE_MS - 120 },
        ),
      );
      // 所有元素完全进场后再计时；跳过时卸载组件会主动取消动画。
      void Promise.all(animations.map((animation) => animation.finished)).then(
        hold,
        (error: unknown) => {
          if (active) throw error;
        },
      );
    }
    return () => {
      active = false;
      window.clearTimeout(timer);
      animations.forEach((animation) => animation.cancel());
    };
  }, [cutIn, finish]);

  useEffect(() => {
    const before = document.activeElement;
    overlay.current?.focus({ preventScroll: true });
    const handle = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        finish();
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        overlay.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener('keydown', handle);
    return () => {
      document.removeEventListener('keydown', handle);
      if (before instanceof HTMLElement && before.isConnected)
        before.focus({ preventScroll: true });
    };
  }, [finish]);

  return createPortal(
    <div
      className={`support-cut-in${cutIn.reducedMotion ? ' support-cut-in--reduced' : ''}`}
      ref={overlay}
      role="dialog"
      aria-modal="true"
      aria-label={`${name}登场`}
      aria-description="点击任意位置，或按回车、空格、Escape 跳过演出。"
      tabIndex={0}
      onClick={(event) => {
        // 点击完成后才关闭遮罩，消费当前事件，避免误触下层战斗操作。
        event.preventDefault();
        event.stopPropagation();
        finish();
      }}
    >
      <div className="support-cut-in__band">
        <div className="support-cut-in__ribbon" ref={ribbon}>
          <div className="support-cut-in__portrait" ref={portrait}>
            {hasPortrait ? (
              <img src={asset(cutIn.partner)} alt="" />
            ) : (
              <Shield className="support-cut-in__program" aria-hidden="true" />
            )}
          </div>
          <div className="support-cut-in__dialogue" ref={dialogue} role="status">
            <strong>{name}</strong>
            <p>“{quote}”</p>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
