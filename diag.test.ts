import { it } from 'vitest';
import { autoplay } from './engine.test';
it('diag kuzuha/venom core fight length', () => {
  for (const branch of ['kuzuha', 'venom'] as const) {
    const { save } = autoplay(branch === 'kuzuha' ? 'renamon' : 'impmon', branch, 1);
    console.log(branch, 'row', save.run!.row, 'hp', save.run!.hp, 'turn', save.run!.battle?.turn, 'won', save.run!.won);
  }
});
