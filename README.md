# Logic Quest Academy

Quero criar uma plataforma educacional moderna, responsiva e com aparência de jogo (gamificada), voltada para alunos do 5º ano do Ensino Fundamental (9 a 11 anos).

A plataforma deve possuir tela inicial com seleção de jogos, sistema de pontuação, cronômetro, níveis, feedback visual, animações leves e interface colorida e intuitiva.

Tema visual:

 Tecnologia + educação

 Azul, laranja e branco

 Cartões arredondados

 Botões grandes

 Ícones amigáveis

 Interface totalmente responsiva (computador, tablet e celular)

TELA INICIAL

Título:

Desafios de Lógica

Botões:

 Jogo 1 – Lógica Matemática

 Jogo 2 – Plano Cartesiano

No topo mostrar:

 Nome do jogo

 Melhor pontuação

 Nível alcançado

JOGO 1 – Lógica Matemática

Objetivo:

O jogador responde se uma proposição lógica é Verdadeira ou Falsa antes do tempo acabar.

Regras

 Cronômetro de 2 minutos.

 Cada resposta correta vale 10 pontos.

 Resposta errada não tira pontos.

 Ao acertar várias seguidas, sobe de nível automaticamente.

 Quando o tempo acabar:

 mostrar pontuação;

 quantidade de acertos;

 quantidade de erros;

 nível alcançado;

 botão "Jogar novamente".

Sempre exibir no topo:

 Tempo restante

 Pontuação

 Nível atual

Abaixo aparece apenas uma proposição por vez.

Botões:

🟢 Verdadeiro

🔴 Falso

Após responder:

 resposta correta → animação verde

 resposta incorreta → animação vermelha

A próxima questão aparece automaticamente.

Sistema de dificuldade

Nível 1

Proposições simples utilizando:

 verdadeiro

 falso

 operador E

 operador OU

Exemplos:

4 + 3 = 7

5 + 5 = 11

V e F

V ou V

F ou F

V e V

Misturar expressões matemáticas e proposições booleanas.

Nível 2

Adicionar comparações entre igualdades.

Exemplos:

5 = 5 e 3 + 5 = 8

7 = 8 ou 9 = 9

10 - 5 = 5 e 2 + 2 = 5

Misturar verdadeiro e falso.

Nível 3

Adicionar operadores:

<

=

<=

Exemplos:

3 > 2 e 5 < 10

7 < 4 ou 9 > 2

6 >= 6 e 3 < 2

10 <= 9 ou 4 > 1

Nível 4

Misturar operações matemáticas completas.

Exemplos:

3 + 5 > 2 + 1

5 - 2 < 7 + 1

10 - 3 > 4 + 1

8 + 2 <= 15 - 1

7 + 4 = 11 e 6 > 2

Gerar milhares de combinações aleatórias.

Nunca repetir muitas questões.

Geração automática das questões

As questões devem ser geradas dinamicamente.

Utilizar:

 soma

 subtração

 comparação

 igualdade

 operadores E

 operadores OU

Garantir que aproximadamente metade das respostas sejam verdadeiras e metade falsas.

JOGO 2 – Plano Cartesiano

Objetivo:

Interpretar corretamente posições em um plano cartesiano.

Estrutura

Mostrar um plano cartesiano de:

16 x 16

com eixos positivos e negativos.

Escala:

-8 até +8 nos dois eixos.

As letras devem aparecer como pontos coloridos.

Exemplo:

A

B

C

D

As posições das letras mudam aleatoriamente a cada questão.

Nunca podem existir duas letras na mesma posição.

Nível 1

O plano apresenta quatro letras.

Exemplo:

A

B

C

D

Uma pergunta aparece:

Qual letra está na posição

(3, -5)?

Alternativas:

A

B

C

D

O aluno escolhe uma.

Depois gera outra questão completamente diferente.

As letras mudam de posição.

Nível 2

Agora a pergunta é o contrário.

Exemplo:

Em qual posição está a letra C?

Alternativas:

(2,5)

(-4,1)

(6,-2)

(-1,-3)

Sempre quatro alternativas.

Apenas uma correta.

As alternativas erradas devem parecer plausíveis.

Sistema de Pontuação

Cada acerto:

+10 pontos

Mostrar:

Pontuação

Cronômetro

Nível

Sequência de acertos

Progressão

Após determinado número de acertos consecutivos:

subir de nível automaticamente.

Mostrar uma animação:

"Nível 2"

"Nível 3"

"Nível 4"

Tela Final

Quando o tempo terminar:

Mostrar um painel contendo:

🏆 Pontuação Final

✅ Acertos

❌ Erros

⭐ Nível alcançado

📈 Aproveitamento (%)

Botões:

Jogar novamente

Voltar ao menu

Recursos Técnicos

A aplicação deve ser construída utilizando:

 React

 TypeScript

 Tailwind CSS

 Componentes modernos e reutilizáveis

 Animações suaves

 Responsiva para desktop, tablet e celular

As questões devem ser geradas automaticamente por algoritmos, evitando repetições e garantindo variedade.

O código deve ser organizado em componentes separados para facilitar futuras expansões.

Preparação para futuras expansões

Estruture o projeto para permitir adicionar novos jogos posteriormente através de um sistema de módulos, sem necessidade de alterar os jogos existentes. Cada jogo deve funcionar como um componente independente, compartilhando apenas elementos comuns da plataforma (menu, pontuação, cronômetro e estilo visual).

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://logic-play-integracao.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6de7f5b7-a24b-4a2e-b932-591b97e8ed14).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
