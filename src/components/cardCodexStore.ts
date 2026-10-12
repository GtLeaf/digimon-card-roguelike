// 图鉴检索状态：模块级保存，关闭再打开图鉴时保留，刷新页面后重置；不写入存档。
import { useSyncExternalStore } from 'react';
import { DEFAULT_QUERY, tokenize } from '../game/cardIndex';
import type { CardQuery } from '../game/cardIndex';

export type CodexTab = 'digimon' | 'card';
interface CodexState {
  tab: CodexTab;
  query: CardQuery;
}
let state: CodexState = { tab: 'digimon', query: DEFAULT_QUERY };
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
function commit(next: CodexState) {
  state = next;
  listeners.forEach((l) => l());
}

export function setCodexTab(tab: CodexTab) {
  commit({ ...state, tab });
}
export function setCodexQuery(update: CardQuery | ((q: CardQuery) => CardQuery)) {
  const prev = state.query;
  let next = typeof update === 'function' ? update(prev) : update;
  // 从无关键词开始输入时，恢复按相关度排序。
  if (
    !tokenize(prev.text).length &&
    tokenize(next.text).length &&
    next.relevance === prev.relevance
  )
    next = { ...next, relevance: true };
  commit({ ...state, query: next });
}
export function useCodexState(): CodexState {
  return useSyncExternalStore(subscribe, () => state);
}
/** 仅供测试页重置。 */
export function resetCodexState() {
  commit({ tab: 'digimon', query: DEFAULT_QUERY });
}
