import { RotateCcw } from 'lucide-react';

export function AbandonView({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <>
      <p className="modal-note">当前牌组、金币与进化将结束。已获得的扫描数据和伙伴会保留。</p>
      <div className="modal-actions">
        <button className="secondary" onClick={onCancel}>
          继续当前旅途
        </button>
        <button className="primary" onClick={onConfirm}>
          <RotateCcw size={16} />
          重新出发
        </button>
      </div>
    </>
  );
}
