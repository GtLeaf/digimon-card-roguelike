import { Heart, Shield } from 'lucide-react';

export function Health({ hp, max, block = 0 }: { hp: number; max: number; block?: number }) {
  return (
    <div className="health">
      <div className="health-track">
        <i style={{ width: `${(100 * hp) / max}%` }} />
      </div>
      <span>
        <Heart size={12} />
        {hp}
        <small>/{max}</small>
        {block > 0 && (
          <b>
            <Shield size={12} />
            {block}
          </b>
        )}
      </span>
    </div>
  );
}
