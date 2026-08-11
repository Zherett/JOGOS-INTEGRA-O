# Novo jogo: Desafio das Porcentagens

Um oitavo jogo na plataforma, com a mesma identidade visual, fluxo e recursos dos demais (tela inicial com play, contagem 3-2-1, HUD, bônus de tempo, modo equipes, resultado final e histórico da última partida).

## Experiência do jogador

1. Escolhe o jogo no menu (após liberar o código de acesso).
2. Tela inicial: modo normal ou equipes, switch de tempo extra (ativo por padrão) e card da última partida.
3. Contagem 3, 2, 1, VAI! e partida de 2:00 (máximo 2:30 com bônus).
4. Progressão por níveis, 5 questões por nível:
   - Nível 1 — Barras e Bateria: bateria, barra de carregamento, tanque e medidor divididos em 4 ou 10 partes, sem números nas marcações.
   - Nível 2 — Diagramas de Pizza: círculos em 4 ou 10 fatias; questões diretas ("qual porcentagem?") e inversas (clicar nas fatias para representar 75%).
   - Nível 3 — Porcentagem de Quantidades: grades de objetos (maçãs, lápis, bolas, estrelas, livros, moedas) com números pequenos e amigáveis.
   - Nível 4 — Situações do Cotidiano: descontos, bateria, turma, produtos, dinheiro, com apoio visual.
   - Após o nível 4: Modo Desafio, misturando todos os tipos aleatoriamente e aumentando a dificuldade.
5. Feedback imediato: verde/vermelho, som, e uma frase curta ("50% significa metade", "25% é 1 de 4 partes").
6. Fim do tempo: tela de resultados com pontuação, nível, acertos, erros, maior sequência, tempo utilizado, aproveitamento e a frase "Você dominou X% dos desafios", com "Jogar novamente" e "Voltar ao menu".

## Regras

- +10 por acerto, -5 por erro, pontuação nunca abaixo de zero.
- Foco em 10%, 25%, 50%, 75% e 100%.
- Bônus de tempo por marcos de sequência (5, 10, 15 acertos seguidos): +10s cada, teto de 2:30, com animação "+10 SEGUNDOS!".
- Sem repetição consecutiva do mesmo tipo/valor de questão.
- HUD: tempo, pontos, nível, acertos, sequência e progresso "Questões: 3/5".
- Modo equipes igual aos outros jogos: barra de placar, troca automática de equipe ao jogar novamente, "Finalizar jogo" com pódio.

## Detalhes técnicos

- `src/lib/percent-content.ts`: geradores dinâmicos de questões por nível (barras/medidores, pizza, quantidades, cotidiano) e textos das dicas pedagógicas.
- Componentes visuais reutilizáveis em `src/components/games/percent/`: `PercentBar` (bateria/barra/tanque/medidor), `PieDiagram` (interativo e estático) e `ObjectGrid`.
- `src/components/games/PercentGame.tsx`: orquestra estado, níveis, pontuação derivada (acertos×10 − erros×5, mínimo 0), `useRoundClock` com bônus por marcos, `Countdown`, `GameTopBar`, `GameHud`, `TeamScoreBar`, `ResultPanel`, `SessionSummary` e `saveLastMatch`/`updateBest`.
- Integração: novo id `porcentagem` em `game-storage.ts` (stats e defaults), card no `Menu.tsx` (após Campo Minado) e render em `src/routes/index.tsx`.
- Código de acesso: um novo código de 6 caracteres em `game-codes.ts`, informado no chat após a implementação; o código mestre também libera o jogo.
- Sons via WebAudio, como nos demais jogos. Nenhum jogo existente muda de comportamento.
