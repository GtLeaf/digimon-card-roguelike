// 兼容旧入口；唯一实现为真实战斗校准 tools/audit_card_balance.mjs。
// 新调用统一使用 npm run audit:balance -- --label <标签>。
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
await import(pathToFileURL(resolve(import.meta.dirname, '../tools/audit_card_balance.mjs')).href);
