# Desafios de Lógica — Projeto INTEGRAÇÃO (SEMED Coari)

Plataforma educacional gamificada voltada para alunos do **5º ao 9º ano do Ensino Fundamental**, idealizada pelo **Projeto INTEGRAÇÃO — SEMED Coari**.

A plataforma conta com **10 jogos educativos**, sistema de **progressão por XP e Níveis (Patentes)**, **Ranking Geral, por Jogo e por Escola** integrado ao **Microsoft Azure PlayFab**, modo **Competição por Equipes** e **Painel do Administrador (ADM)**.

---

## Escolas Participantes (SEMED Coari)

1. **Raimundo Bezerra** (6º ao 9º ano)
2. **Elisângela Litaiff** (5º ano)
3. **Raimunda Cruz** (5º ano)
4. **Maria de Nazaré** (5º ano)
5. **Ursulina Souza** (5º ano)

---

## Catálogo de Jogos e Códigos Padrão

| Jogo | Código Padrão | Descrição |
| :--- | :---: | :--- |
| **Lógica Matemática** | `L1MT26` | Proposições de Verdadeiro ou Falso contra o tempo (4 níveis) |
| **Plano Cartesiano** | `C2PL26` | Localização de pontos e coordenadas no plano cartesiano |
| **Formas e Cores** | `F3FC26` | Reconhecimento e encaixe de formas geométricas por cor e tamanho |
| **Memória das Cores** | `M4CR26` | Sequências visuais e sonoras progressivas |
| **Caça às Variáveis** | `V5CV26` | Resolução de incógnitas com arrastar e soltar |
| **RoboGrid** | `R6RG26` | Localização espacial e movimentação em tabuleiro 10×10 |
| **Desafio das Partes** | `Q9PC26` | Porcentagens (barras, pizza, réguas, problemas) e Frações |
| **Campo Minado Lógico** | `N7CM26` | Tabuleiro 8×8 com cartas de desafio e cartas bônus |
| **Completando a Lógica** | `K0CL26` | Complete expressões arrastando operadores e digitando números |
| **RPG da Lógica** | `P8RP26` | Aventura 2D: derrote monstros resolvendo desafios de lógica |

- **Código Mestre do Professor (libera todos os jogos ativos):** `SEMED26`
- **Acesso ao Painel do Administrador (ADM):** Botão `ADM` no topo da tela inicial (senha padrão: `SEMED26`).

---

## Como Rodar Localmente

```bash
npm install
npm run dev
```

Para rodar os testes automatizados:

```bash
npm test
```

Para gerar o pacote estático de produção (`dist/`):

```bash
npm run build
```

---

## Publicação no GitHub Pages e Configuração do Microsoft Azure PlayFab

1. **GitHub Pages Automático:**
   - O repositório já possui o workflow `.github/workflows/deploy.yml`.
   - No GitHub, acesse **Settings → Pages** e em **Build and deployment > Source**, selecione **GitHub Actions**.
2. **Microsoft Azure PlayFab:**
   - Crie um título gratuito em [developer.playfab.com](https://developer.playfab.com).
   - Em **Settings → API Features**, desmarque *"Require both username and email"*.
   - Em **Automation → CloudScript**, cole o conteúdo de [`playfab/cloudscript.js`](./playfab/cloudscript.js) para ativar a validação anti-cheat e sincronização de configurações do ADM.
   - Defina o seu `Title ID` na variável `VITE_PLAYFAB_TITLE_ID` (nas variáveis do GitHub Actions ou diretamente na aba **PlayFab & Alunos** dentro do **Painel ADM** da plataforma).
