import { CircleDashed, CircleHelp, CircleMinus } from 'lucide-react';
import vaccineIcon from '../assets/attributes/vaccine.svg';
import virusIcon from '../assets/attributes/virus.svg';
import dataIcon from '../assets/attributes/data.svg';
import {
  ATTRIBUTE_INFO,
  DIGIMON_PROFILES,
  attributeDescription,
  attributeText,
} from '../game/attributes';
import './AttributeLabel.css';

// 《网络侦探》属性符号矢量重绘，素材来源见属性设计文档。
const attributeIcons = { Va: vaccineIcon, Vi: virusIcon, Da: dataIcon };

export function AttributeLabel({ id }: { id: string }) {
  const profile = DIGIMON_PROFILES[id];
  const attribute = profile?.attribute;
  const name = attribute ? ATTRIBUTE_INFO[attribute].name : attributeText(id);
  const description = attributeDescription(id);
  if (attribute && attribute !== 'Un') {
    const url = `url("${attributeIcons[attribute]}")`;
    return (
      <span
        className={`attribute-icon attribute-icon-symbol attribute-icon-${attribute}`}
        role="img"
        aria-label={`属性：${name}`}
        title={description}
        style={{ maskImage: url, WebkitMaskImage: url }}
      />
    );
  }
  const Icon = attribute === 'Un' ? CircleHelp : profile?.entity ? CircleMinus : CircleDashed;
  return (
    <Icon
      className={`attribute-icon attribute-icon-${attribute ?? 'none'}`}
      role="img"
      aria-label={`属性：${name}`}
    >
      <title>{description}</title>
    </Icon>
  );
}
