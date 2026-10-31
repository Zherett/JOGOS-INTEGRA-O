# AGENTS.md — Diretrizes do Projeto

- Este projeto é uma Single Page Application (SPA) estática construída com **Vite + React 19 + TypeScript + Tailwind CSS v4**, voltada para hospedagem no **GitHub Pages** e integrada ao **Microsoft Azure PlayFab** (`src/lib/playfab.ts`).
- Mantenha a geração de questões e a validação de respostas em módulos de lógica de jogo browser-safe (`src/lib/`), com testes automatizados adjacentes (`*.test.ts`), para que a UI e os testes utilizem o mesmo avaliador.
