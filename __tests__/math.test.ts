import { evaluate } from '../src/lib/tools/math';

describe('safe calculator', () => {
  it.each([
    ['1 + 2 * 3', 7],
    ['(1 + 2) * 3', 9],
    ['2 ^ 3 ^ 2', 512],
    ['-2 ^ 2', -4],
    ['sqrt(1764) + 17.5 * 2340 / 100', 451.5],
    ['max(3, 9, 4)', 9],
    ['round(pi * 100) / 100', 3.14],
    ['2,340 * 2', 4680],
    ['10 % 4', 2],
  ])('%s = %p', (expr, expected) => {
    expect(evaluate(expr)).toBeCloseTo(expected as number, 10);
  });

  it.each(['1 / 0', 'alert(1)', '2 +', 'constructor', '1 ; 2', 'x'.repeat(600)])('rejects %s', expr => {
    expect(() => evaluate(expr)).toThrow();
  });
});
