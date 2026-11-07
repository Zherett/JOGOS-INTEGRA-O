import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  createInboxMessage,
  loadAllInboxMessages,
  getInboxMessagesForRecipient,
  getInboxMessagesForPlayer,
  markInboxMessageAsRead,
  markAllInboxMessagesAsReadForRecipient,
  recordDeviceSecurityAlert,
  clearMemoryInboxMessages,
  sendAdminBroadcastMessage,
  claimInboxReward,
  deleteInboxMessageForPlayer,
  getInboxCountsForPlayer,
} from "./inbox-messages.ts";
import type { PlayerProfile } from "./playfab.ts";

function createTestStudent(overrides: Partial<PlayerProfile> = {}): PlayerProfile {
  return {
    id: "aluno_1",
    nick: "Dede",
    nickNormalized: "dede",
    full_name: "MARCOS ANDRÉ",
    school: "Maria de Nazaré",
    grade: "5º ano",
    birthdate: "2014-06-10",
    xp: 500,
    seasonXp: 500,
    level: 3,
    wins: 10,
    matchesPlayed: 15,
    pointsBalance: 100,
    careerPoints: 250,
    badges: [],
    unlockedMedals: [],
    ...overrides,
  };
}

describe("Sistema Completo de Caixa de Entrada e Correio (inbox-messages)", () => {
  beforeEach(() => {
    clearMemoryInboxMessages();
    if (typeof window !== "undefined") {
      window.localStorage.clear();
    }
  });

  it("cria e recupera mensagens diretas por destinatário", () => {
    createInboxMessage({
      recipientId: "aluno_1",
      sender: "seguranca",
      category: "seguranca_acesso",
      title: "Alerta de teste",
      body: "Conteúdo do teste",
    });

    const student = createTestStudent({ id: "aluno_1" });
    const msgs = getInboxMessagesForPlayer(student);
    assert.equal(msgs.length, 1);
    assert.equal(msgs[0].title, "Alerta de teste");
    assert.equal(msgs[0].read, false);
  });

  it("transmite mensagem broadcast geral (ALL) para todos os alunos", () => {
    sendAdminBroadcastMessage({
      mode: "all",
      title: "Aviso Geral",
      body: "Para toda a rede SEMED",
    });

    const alunoA = createTestStudent({ id: "aluno_a", school: "Raimundo Bezerra" });
    const alunoB = createTestStudent({ id: "aluno_b", school: "Maria de Nazaré" });

    const msgsA = getInboxMessagesForPlayer(alunoA);
    const msgsB = getInboxMessagesForPlayer(alunoB);

    assert.equal(msgsA.length, 1);
    assert.equal(msgsB.length, 1);
    assert.equal(msgsA[0].title, "Aviso Geral");
  });

  it("filtra transmissão por escola e respeita alunos desmarcados (excluídos)", () => {
    sendAdminBroadcastMessage({
      mode: "school",
      targetSchool: "Raimundo Bezerra",
      excludedStudentIds: ["aluno_desmarcado"],
      title: "Reunião de Pais",
      body: "Aviso exclusivo Raimundo Bezerra",
    });

    const alunoRaimundo = createTestStudent({ id: "aluno_raimundo", school: "Raimundo Bezerra" });
    const alunoOutra = createTestStudent({ id: "aluno_outra", school: "Maria de Nazaré" });
    const alunoDesmarcado = createTestStudent({ id: "aluno_desmarcado", school: "Raimundo Bezerra" });

    const msgsRaimundo = getInboxMessagesForPlayer(alunoRaimundo);
    const msgsOutra = getInboxMessagesForPlayer(alunoOutra);
    const msgsDesmarcado = getInboxMessagesForPlayer(alunoDesmarcado);

    assert.equal(msgsRaimundo.length, 1);
    assert.equal(msgsOutra.length, 0);
    assert.equal(msgsDesmarcado.length, 0);
  });

  it("gerencia recompensas de pontos: concede saldo e carreira", () => {
    const student = createTestStudent({ pointsBalance: 50, careerPoints: 100 });
    const msg = sendAdminBroadcastMessage({
      mode: "all",
      title: "Presente do Professor",
      body: "Receba 75 pontos de incentivo!",
      reward: {
        type: "points",
        pointsAmount: 75,
        isSecret: false,
      },
    });

    const res = claimInboxReward(msg.id, student);
    assert.equal(res.success, true);
    assert.equal(student.pointsBalance, 125);
    assert.equal(student.careerPoints, 175);

    // Impede resgate duplicado
    const resDuplicado = claimInboxReward(msg.id, student);
    assert.equal(resDuplicado.success, false);
    assert.equal(student.pointsBalance, 125);
  });

  it("gerencia recompensas de medalhas", () => {
    const student = createTestStudent({ unlockedMedals: [] });
    const msg = sendAdminBroadcastMessage({
      mode: "all",
      title: "Conquista Especial",
      body: "Você ganhou a medalha do Nível 2",
      reward: {
        type: "medal",
        medalId: "lvl_2",
        isSecret: true,
      },
    });

    const res = claimInboxReward(msg.id, student);
    assert.equal(res.success, true);
    assert.equal(student.unlockedMedals?.length, 1);
    assert.equal(student.unlockedMedals?.[0].medalId, "lvl_2");
  });

  it("impede que o aluno apague uma mensagem com recompensa antes de resgatar", () => {
    const student = createTestStudent();
    const msg = sendAdminBroadcastMessage({
      mode: "all",
      title: "Presente Misterioso",
      body: "Contém recompensa secreta",
      reward: {
        type: "points",
        pointsAmount: 50,
        isSecret: true,
      },
    });

    // Tentativa de apagar antes de resgatar -> DEVE FALHAR
    const delAntes = deleteInboxMessageForPlayer(msg.id, student);
    assert.equal(delAntes.success, false);
    assert.ok(delAntes.error?.includes("resgatar sua recompensa"));

    // Resgatar a recompensa
    claimInboxReward(msg.id, student);

    // Agora deve permitir apagar
    const delDepois = deleteInboxMessageForPlayer(msg.id, student);
    assert.equal(delDepois.success, true);

    // Mensagem não deve mais aparecer na caixa de entrada
    const msgs = getInboxMessagesForPlayer(student);
    assert.equal(msgs.length, 0);
  });

  it("permite apagar mensagem comum (sem recompensa) após leitura", () => {
    const student = createTestStudent();
    const msg = createInboxMessage({
      recipientId: student.id,
      sender: "adm",
      category: "comunicado",
      title: "Aviso simples",
      body: "Sem prêmios",
    });

    markInboxMessageAsRead(msg.id, student.id);
    const del = deleteInboxMessageForPlayer(msg.id, student);
    assert.equal(del.success, true);

    const msgs = getInboxMessagesForPlayer(student);
    assert.equal(msgs.length, 0);
  });

  it("calcula corretamente os contadores de mensagens não lidas e recompensas pendentes", () => {
    const student = createTestStudent();

    // Mensagem 1: sem recompensa, não lida
    createInboxMessage({
      recipientId: student.id,
      sender: "adm",
      category: "comunicado",
      title: "M1",
      body: "B1",
    });

    // Mensagem 2: com recompensa não resgatada
    sendAdminBroadcastMessage({
      mode: "all",
      title: "M2",
      body: "B2",
      reward: { type: "points", pointsAmount: 20, isSecret: false },
    });

    const counts1 = getInboxCountsForPlayer(student);
    assert.equal(counts1.unreadCount, 2);
    assert.equal(counts1.unclaimedRewardsCount, 1);
    assert.equal(counts1.totalAlerts, 3);
  });
});
