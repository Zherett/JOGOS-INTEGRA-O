import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  createInboxMessage,
  loadAllInboxMessages,
  getInboxMessagesForRecipient,
  markInboxMessageAsRead,
  markAllInboxMessagesAsReadForRecipient,
  recordDeviceSecurityAlert,
  clearMemoryInboxMessages,
} from "./inbox-messages.ts";

describe("Sistema Preparatório de Mensagens e Alertas de Segurança (inbox-messages)", () => {
  beforeEach(() => {
    clearMemoryInboxMessages();
    if (typeof window !== "undefined") {
      window.localStorage.clear();
    }
  });

  it("cria e recupera mensagens por destinatário", () => {
    createInboxMessage({
      recipientId: "joao_silva",
      sender: "seguranca",
      category: "seguranca_acesso",
      title: "Alerta de teste",
      body: "Conteúdo do teste",
    });

    createInboxMessage({
      recipientId: "admin",
      sender: "sistema",
      category: "comunicado",
      title: "Aviso institucional",
      body: "Para todos os coordenadores",
    });

    const joaoMsgs = getInboxMessagesForRecipient("joao_silva");
    assert.equal(joaoMsgs.length, 1);
    assert.equal(joaoMsgs[0].title, "Alerta de teste");
    assert.equal(joaoMsgs[0].read, false);

    const adminMsgs = getInboxMessagesForRecipient("admin");
    assert.equal(adminMsgs.length, 1);
    assert.equal(adminMsgs[0].title, "Aviso institucional");
  });

  it("marca mensagem individual como lida", () => {
    const msg = createInboxMessage({
      recipientId: "maria_clara",
      sender: "sistema",
      category: "comunicado",
      title: "Parabéns!",
      body: "Você subiu de nível",
    });

    assert.equal(msg.read, false);
    markInboxMessageAsRead(msg.id);

    const msgs = getInboxMessagesForRecipient("maria_clara");
    assert.equal(msgs[0].read, true);
  });

  it("marca todas as mensagens do destinatário como lidas em lote", () => {
    createInboxMessage({
      recipientId: "pedro_lucas",
      sender: "sistema",
      category: "medalha_ouro",
      title: "Medalha Ouro 1",
      body: "Corpo 1",
    });
    createInboxMessage({
      recipientId: "pedro_lucas",
      sender: "sistema",
      category: "medalha_ouro",
      title: "Medalha Ouro 2",
      body: "Corpo 2",
    });

    markAllInboxMessagesAsReadForRecipient("pedro_lucas");
    const msgs = getInboxMessagesForRecipient("pedro_lucas");
    assert.equal(msgs.every((m) => m.read), true);
  });

  it("gera alertas simultâneos para aluno e ADM quando há tentativa/acesso em outro aparelho", () => {
    const { studentMsg, adminMsg } = recordDeviceSecurityAlert({
      studentId: "douglas_10",
      studentNick: "douglas_10",
      studentFullName: "DOUGLAS ALMEIDA",
      deviceInfo: "Chrome no Windows",
      timestamp: Date.now(),
    });

    assert.equal(studentMsg.recipientId, "douglas_10");
    assert.equal(studentMsg.category, "seguranca_acesso");
    assert.ok(studentMsg.body.includes("Sua conta foi conectada em outro dispositivo"));

    assert.equal(adminMsg.recipientId, "admin");
    assert.equal(adminMsg.category, "seguranca_acesso");
    assert.ok(adminMsg.title.includes("douglas_10"));
  });
});
