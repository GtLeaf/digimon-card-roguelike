// 属性是物种资料；本轮只展示，不参与伤害、掉落或进化条件。
export type DigimonAttribute = 'Va' | 'Vi' | 'Da' | 'Un';

export const ATTRIBUTE_INFO: Record<DigimonAttribute, { name: string; english: string }> = {
  Va: { name: '疫苗', english: 'Vaccine' },
  Vi: { name: '病毒', english: 'Virus' },
  Da: { name: '数据', english: 'Data' },
  Un: { name: '未知', english: 'Unknown' },
};

export interface DigimonProfile {
  // null 表示未标注或不适用；不能把这两种情况默认为 Un。
  attribute: DigimonAttribute | null;
  /** 帝厉魔及其代理体使用本作分类，不冒充官方数码兽属性。 */
  entity?: true;
  note?: string;
}

const entity: DigimonProfile = {
  attribute: null,
  entity: true,
  note: '帝厉魔及其代理体不适用数码兽属性。',
};

// 共用同一物种键，搭档、进化、敌人和支援的属性不会各自推断。
// 2026-10-10 官方逐条核对记录见 docs/design/属性资料与互动设计.md。
export const DIGIMON_PROFILES: Readonly<Record<string, DigimonProfile>> = {
  terriermon: { attribute: 'Va' },
  galgomon: { attribute: 'Va' },
  blackgalgomon: { attribute: 'Va' },
  rapidmon: { attribute: 'Va' },
  blackrapidmon: { attribute: 'Va' },
  saintgalgomon: { attribute: 'Va' },
  blacksaintgalgomon: { attribute: 'Va' },
  blackgrowmon: { attribute: 'Vi' },
  blackwargrowlmon: { attribute: 'Vi' },
  chaosdukemon: { attribute: 'Vi' },
  youkomon: { attribute: 'Da' },
  doumon: { attribute: 'Da' },
  guilmon: { attribute: 'Vi' },
  growlmon: { attribute: 'Vi' },
  wargrowlmon: { attribute: 'Vi' },
  renamon: { attribute: 'Da' },
  kyubimon: { attribute: 'Da' },
  taomon: { attribute: 'Da' },
  dukemon: { attribute: 'Vi' },
  megidramon: { attribute: 'Vi' },
  sakuyamon: { attribute: 'Da' },
  kuzuhamon: { attribute: 'Da' },
  impmon: { attribute: 'Vi' },
  sorcerymon: { attribute: 'Va' },
  matadormon: { attribute: 'Vi' },
  matadormonAwakened: {
    attribute: 'Vi',
    note: '本作觉醒形态沿用斗牛士兽的病毒属性。',
  },
  devimon: { attribute: 'Vi' },
  vamdemon: { attribute: 'Vi' },
  beelzebumon: { attribute: 'Vi' },
  beelzebumonblaster: { attribute: 'Vi' },
  venommyotismon: { attribute: 'Vi' },
  belialvamdemon: { attribute: 'Vi' },
  gotsumon: { attribute: 'Da' },
  betamon: { attribute: 'Vi' },
  monodramon: { attribute: 'Va' },
  clockmon: { attribute: 'Da' },
  seadramon: { attribute: 'Da' },
  gekomon: { attribute: 'Vi' },
  skullgreymon: { attribute: 'Vi' },
  machinedramon: { attribute: 'Vi' },
  goblimon: { attribute: 'Vi' },
  mushmon: { attribute: 'Vi' },
  hagurumon: { attribute: 'Vi' },
  picodevimon: { attribute: 'Vi' },
  bakemon: { attribute: 'Vi' },
  devidramon: { attribute: 'Vi' },
  dokugumon: { attribute: 'Vi' },
  sinduramon: { attribute: 'Da' },
  ogremon: { attribute: 'Vi' },
  leomon: { attribute: 'Va' },
  andromon: { attribute: 'Va' },
  icedevimon: { attribute: 'Vi' },
  vajramon: { attribute: 'Va' },
  pawnchessmonblack: { attribute: 'Vi' },
  pawnchessmonwhite: { attribute: 'Vi' },
  knightchessmonblack: { attribute: 'Vi' },
  knightchessmonwhite: { attribute: 'Vi' },
  keramon: { attribute: 'Un' },
  chrysalimon: { attribute: 'Un' },
  knightmon: { attribute: 'Da' },
  phantomon: { attribute: 'Vi' },
  kuramon: { attribute: null, note: '官方图鉴未标注属性，不归入未知种。' },
  diaboromon: { attribute: 'Un' },
  rookchessmon: { attribute: 'Vi' },
  bishopchessmon: { attribute: 'Vi' },
  infermon: { attribute: 'Un' },
  armageddemon: { attribute: 'Un' },
  lilithmon: { attribute: 'Vi' },
  leviamon: { attribute: 'Vi' },
  grandracmon: { attribute: 'Vi' },
  daemon: { attribute: 'Vi' },
  belphemon: {
    attribute: 'Vi',
    note: '睡眠与愤怒形态均为病毒属性。',
  },
  barbamon: { attribute: 'Vi' },
  lopmon: { attribute: 'Da' },

  scout: entity,
  replica: entity,
  corrupt: entity,
  sentinel: entity,
  devourer: entity,
  core: entity,
};

export function digimonAttribute(id: string): DigimonAttribute | null | undefined {
  return DIGIMON_PROFILES[id]?.attribute;
}

export function attributeText(id: string): string {
  const profile = DIGIMON_PROFILES[id];
  if (!profile) return '属性未收录';
  if (!profile.attribute) return profile.entity ? '无适用属性' : '未标注属性';
  return `${profile.attribute} · ${ATTRIBUTE_INFO[profile.attribute].name}`;
}

export function attributeDescription(id: string): string {
  const profile = DIGIMON_PROFILES[id];
  if (!profile) return '该对象的属性资料尚未收录。';
  if (!profile.attribute) return profile.note ?? '官方图鉴未标注属性。';
  const info = ATTRIBUTE_INFO[profile.attribute];
  return `${info.name}（${info.english}）${profile.note ? '；' + profile.note : ''}`;
}
