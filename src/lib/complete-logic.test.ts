import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { checkAnswer, generateQuestion, type CQuestion } from "./complete-logic.ts";

describe("Completando a Lógica — nível 1", () => {
  test("gera duas comparações conectadas com apenas 2 opções ('e'/'ou') entre sentenças e 4 opções nos comparadores", () => {
    const used = new Set<string>();
    const slotPositions = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const q = generateQuestion(1, used);
      assert.equal(q.tokens.length, 7);
      assert.equal(q.hasNum, false);
      assert.equal(q.hasOp, true);
      assert.equal(typeof q.result, "boolean");
      const slot = q.tokens.findIndex((t) => t.t === "slotOp");
      assert.ok([1, 3, 5].includes(slot));
      slotPositions.add(slot);

      // Quando o operador está no meio das duas sentenças (slot === 3), apenas 'e' e 'ou' devem ser oferecidos
      if (slot === 3) {
        assert.equal(q.options.length, 2);
        assert.deepEqual([...q.options].sort(), ["e", "ou"]);
      } else {
        assert.equal(q.options.length, 4);
      }

      assert.equal(q.options.filter((op) => checkAnswer(q, null, op)).length, 1);
      for (const pos of [0, 2, 4, 6]) assert.equal(q.tokens[pos].t, "num");
    }
    assert.ok(slotPositions.has(3));
    assert.ok(slotPositions.has(1) || slotPositions.has(5));
    assert.equal(used.size, 500);
  });

  test("aceita 'e' em 5 > 3 __ 4 < 5 = V com apenas as alternativas 'e' e 'ou'", () => {
    const q: CQuestion = {
      key: "example-connective", kind: 1, hasNum: false, hasOp: true,
      tokens: [{ t: "num", v: 5 }, { t: "op", v: ">" }, { t: "num", v: 3 },
        { t: "slotOp" }, { t: "num", v: 4 }, { t: "op", v: "<" }, { t: "num", v: 5 }],
      result: true, options: ["e", "ou"],
    };
    assert.equal(checkAnswer(q, null, "e"), true);
    assert.equal(checkAnswer(q, null, "+"), false);
  });

  test("aceita comparadores válidos em 5 __ 3 ou 4 < 5 = V", () => {
    const q: CQuestion = {
      key: "example-comparator", kind: 1, hasNum: false, hasOp: true,
      tokens: [{ t: "num", v: 5 }, { t: "slotOp" }, { t: "num", v: 3 },
        { t: "op", v: "ou" }, { t: "num", v: 4 }, { t: "op", v: "<" }, { t: "num", v: 5 }],
      result: true, options: ["<", ">", "=", "+"],
    };
    for (const op of ["<", ">", "="]) assert.equal(checkAnswer(q, null, op), true);
    assert.equal(checkAnswer(q, null, "+"), false);
  });
});
