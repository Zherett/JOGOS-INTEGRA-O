import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  genShape,
  genTF,
  genMystery,
  genBonus,
  buildBoard,
  cellLabel,
  ANSWER_SECONDS,
  ANSWER_TIME_OPTIONS,
  GENERAL_SHAPES,
  TRIANGLE_CLASSIFICATIONS,
} from "./minefield-content.ts";

describe("Campo Minado - Lógica de Conteúdo e Questões de Formas Geométricas", () => {
  it("mantém tempo de resposta fixado em 20 segundos", () => {
    assert.equal(ANSWER_SECONDS, 20);
    assert.deepEqual(ANSWER_TIME_OPTIONS, [20]);
  });

  it("gera coordenadas corretas de A1 até H8 para o tabuleiro 8x8", () => {
    assert.equal(cellLabel(0), "A1");
    assert.equal(cellLabel(7), "H1");
    assert.equal(cellLabel(8), "A2");
    assert.equal(cellLabel(63), "H8");
  });

  it("genShape nunca gera alternativas duplicadas, ambíguas ou redundantes (1000 amostras)", () => {
    const generalLabels = new Set(GENERAL_SHAPES.map((g) => g.label));
    const triangleSubtypes = new Set([
      "Triângulo equilátero",
      "Triângulo isósceles",
      "Triângulo escaleno",
      "Triângulo retângulo",
    ]);

    for (let i = 0; i < 1000; i++) {
      const q = genShape();
      assert.equal(q.kind, "shape");
      assert.equal(q.options.length, 4);

      // Sem alternativas duplicadas
      const uniqueOpts = new Set(q.options);
      assert.equal(uniqueOpts.size, 4);

      // A resposta correta deve sempre estar contida nas alternativas
      assert.ok(q.options.includes(q.answer));

      if (q.prompt === "Qual é o nome desta forma?") {
        // Questão geral: todas as opções devem ser formas gerais
        for (const opt of q.options) {
          assert.ok(generalLabels.has(opt));
          // Jamais pode conter subtipo de triângulo
          assert.equal(triangleSubtypes.has(opt), false);
        }
        // Se a resposta for Triângulo, nenhuma outra opção pode ter a palavra Triângulo
        if (q.answer === "Triângulo") {
          const triangleCount = q.options.filter((o) => o.toLowerCase().includes("triângulo")).length;
          assert.equal(triangleCount, 1);
        }
      } else if (q.prompt === "Quanto aos lados, que tipo de triângulo é este?") {
        // Questão de classificação de triângulos:
        assert.ok(TRIANGLE_CLASSIFICATIONS.map((c) => c.label).includes(q.answer));
        // Todas as 4 alternativas devem ser os tipos de triângulo
        for (const opt of q.options) {
          assert.ok(triangleSubtypes.has(opt));
        }
        // Jamais pode conter a opção genérica 'Triângulo' isolada
        assert.equal(q.options.includes("Triângulo"), false);
      } else {
        assert.fail(`Prompt desconhecido: ${q.prompt}`);
      }
    }
  });

  it("buildBoard cria 64 cartas com ids e labels válidos sem ambiguidade nas cartas de forma", () => {
    const board = buildBoard();
    assert.equal(board.length, 64);

    const ids = new Set(board.map((c) => c.id));
    assert.equal(ids.size, 64);

    for (const card of board) {
      if (card.kind === "shape") {
        assert.equal(card.options.length, 4);
        assert.ok(card.options.includes(card.answer));
        assert.equal(new Set(card.options).size, 4);

        if (card.options.includes("Triângulo")) {
          // Não pode conter subtipos de triângulo junto
          assert.equal(card.options.includes("Triângulo escaleno"), false);
          assert.equal(card.options.includes("Triângulo isósceles"), false);
          assert.equal(card.options.includes("Triângulo equilátero"), false);
        }
      }
    }
  });

  it("genTF gera expressões com respostas corretas", () => {
    for (let i = 0; i < 50; i++) {
      const q = genTF();
      assert.equal(q.kind, "tf");
      assert.deepEqual(q.options, ["Verdadeiro", "Falso"]);
      assert.ok(["Verdadeiro", "Falso"].includes(q.answer));
    }
  });

  it("genMystery gera equações consistentes com 4 opções únicas", () => {
    for (let i = 0; i < 50; i++) {
      const q = genMystery();
      assert.equal(q.kind, "mystery");
      assert.equal(q.options.length, 4);
      assert.equal(new Set(q.options).size, 4);
      assert.ok(q.options.includes(q.answer));
    }
  });

  it("genBonus gera bônus com pontuação não nula", () => {
    for (let i = 0; i < 50; i++) {
      const b = genBonus();
      assert.equal(b.kind, "bonus");
      assert.notEqual(b.points, 0);
      assert.ok(Math.abs(b.points) >= 1);
      assert.ok(Math.abs(b.points) <= 3);
    }
  });
});
