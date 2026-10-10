import { attributeDescription, attributeText } from '../game/attributes';

export function AttributeLabel({ id, compact = false }: { id: string; compact?: boolean }) {
  const text = attributeText(id);
  return (
    <span aria-label={`属性：${text}`} title={attributeDescription(id)}>
      {compact ? text : `属性：${text}`}
    </span>
  );
}
