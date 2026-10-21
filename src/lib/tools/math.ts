/**
 * Safe arithmetic evaluator (recursive descent) — no eval / Function().
 * Supports + - * / % ^, parentheses, unary minus, constants (pi, e) and
 * common functions (sqrt, abs, sin, cos, tan, asin, acos, atan, ln, log, log10, log2,
 * exp, floor, ceil, round, min, max, pow).
 */
const FUNCS: Record<string, (...a: number[]) => number> = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  ln: Math.log,
  log: Math.log10,
  log10: Math.log10,
  log2: Math.log2,
  exp: Math.exp,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  min: Math.min,
  max: Math.max,
  pow: Math.pow,
};
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E };

type Token =
  | { t: 'num'; v: number }
  | { t: 'id'; v: string }
  | { t: 'op'; v: string };

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  const s = src
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/,(?=\d{3}\b)/g, '');
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
    } else if (/[0-9.]/.test(c)) {
      const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(s.slice(i));
      if (!m) {
        throw new Error(`Invalid number at ${i}`);
      }
      tokens.push({ t: 'num', v: parseFloat(m[0]) });
      i += m[0].length;
    } else if (/[a-z_]/i.test(c)) {
      const m = /^[a-z_][a-z0-9_]*/i.exec(s.slice(i))!;
      tokens.push({ t: 'id', v: m[0].toLowerCase() });
      i += m[0].length;
    } else if ('+-*/%^(),'.includes(c)) {
      tokens.push({ t: 'op', v: c });
      i++;
    } else {
      throw new Error(`Unexpected character "${c}"`);
    }
  }
  return tokens;
}

export function evaluate(expression: string): number {
  if (expression.length > 500) {
    throw new Error('Expression too long');
  }
  const tokens = tokenize(expression);
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (v: string) => peek()?.t === 'op' && peek()!.v === v;
  const expect = (v: string) => {
    if (!isOp(v)) {
      throw new Error(`Expected "${v}"`);
    }
    pos++;
  };

  const expr = (): number => {
    let v = term();
    while (isOp('+') || isOp('-')) {
      const op = tokens[pos++].v;
      const r = term();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  };
  const term = (): number => {
    let v = unary();
    while (isOp('*') || isOp('/') || isOp('%')) {
      const op = tokens[pos++].v;
      const r = unary();
      if ((op === '/' || op === '%') && r === 0) {
        throw new Error('Division by zero');
      }
      v = op === '*' ? v * r : op === '/' ? v / r : v % r;
    }
    return v;
  };
  const unary = (): number => {
    if (isOp('-')) {
      pos++;
      return -unary();
    }
    if (isOp('+')) {
      pos++;
      return unary();
    }
    return power();
  };
  const power = (): number => {
    const base = primary();
    if (isOp('^')) {
      pos++;
      return Math.pow(base, unary()); // right-associative
    }
    return base;
  };
  const primary = (): number => {
    const tok = peek();
    if (!tok) {
      throw new Error('Unexpected end of expression');
    }
    if (tok.t === 'num') {
      pos++;
      return tok.v;
    }
    if (tok.t === 'id') {
      pos++;
      if (tok.v in CONSTS) {
        return CONSTS[tok.v];
      }
      const fn = FUNCS[tok.v];
      if (!fn) {
        throw new Error(`Unknown identifier "${tok.v}"`);
      }
      expect('(');
      const args = [expr()];
      while (isOp(',')) {
        pos++;
        args.push(expr());
      }
      expect(')');
      return fn(...args);
    }
    if (isOp('(')) {
      pos++;
      const v = expr();
      expect(')');
      return v;
    }
    throw new Error(`Unexpected "${tok.v}"`);
  };

  const result = expr();
  if (pos < tokens.length) {
    throw new Error(`Unexpected "${tokens[pos].v}"`);
  }
  if (!Number.isFinite(result)) {
    throw new Error('Result is not a finite number');
  }
  return result;
}
