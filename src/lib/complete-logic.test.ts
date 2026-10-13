import { describe, expect, test } from "bun:test";
import { checkAnswer, generateQuestion, type CQuestion } from "./complete-logic";

describe("Completando a Lógica — nível 1", () => {
  test("gera duas comparações conectadas, quatro opções e uma resposta válida", () => {
    const used = new Set<string>();
    const slotPositions = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const q = generateQuestion(1, used);
      expect(q.tokens).toHaveLength(7);
      expect(q.hasNum).toBe(false);
      expect(q.hasOp).toBe(true);
      expect(typeof q.result).toBe("boolean");
      expect(q.options).toHaveLength(4);
      expect(q.options.filter((op) => checkAnswer(q, null, op))).toHaveLength(1);
      const slot = q.tokens.findIndex((t) => t.t === "slotOp");
      expect([1, 3, 5]).toContain(slot);
      slotPositions.add(slot);
      for (const pos of [0, 2, 4, 6]) expect(q.tokens[pos].t).toBe("num");
    }
    expect(slotPositions.has(3)).toBe(true);
    expect(slotPositions.has(1) || slotPositions.has(5)).toBe(true);
    expect(used.size).toBe(500);
  });

  test("aceita e em 5 > 3 __ 4 < 5 = V", () => {
    const q: CQuestion = {
      key: "example-connective", kind: 1, hasNum: false, hasOp: true,
      tokens: [{ t: "num", v: 5 }, { t: "op", v: ">" }, { t: "num", v: 3 },
        { t: "slotOp" }, { t: "num", v: 4 }, { t: "op", v: "<" }, { t: "num", v: 5 }],
      result: true, options: ["e", "ou", "+", "−"],
    };
    expect(checkAnswer(q, null, "e")).toBe(true);
    expect(checkAnswer(q, null, "+")).toBe(false);
  });

  test("aceita comparadores válidos em 5 __ 3 ou 4 < 5 = V", () => {
    const q: CQuestion = {
      key: "example-comparator", kind: 1, hasNum: false, hasOp: true,
      tokens: [{ t: "num", v: 5 }, { t: "slotOp" }, { t: "num", v: 3 },
        { t: "op", v: "ou" }, { t: "num", v: 4 }, { t: "op", v: "<" }, { t: "num", v: 5 }],
      result: true, options: ["<", ">", "=", "+"],
    };
    for (const op of ["<", ">", "="]) expect(checkAnswer(q, null, op)).toBe(true);
    expect(checkAnswer(q, null, "+")).toBe(false);
  });
});