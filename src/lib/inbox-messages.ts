// Modulo Preparatorio de Mensagens e Notificacoes do Sistema (Futuro Sistema de E-mail / Correio)
// Permite registrar alertas de seguranca (login em outro aparelho), conquistas de medalhas ouro+ e comunicados da administracao.

export type InboxMessageCategory =
  | "seguranca_acesso"
  | "medalha_ouro"
  | "pioneiro_medalha"
  | "comunicado";

export interface SystemInboxMessage {
  id: string;
  recipientId: string; // ID / slug do aluno ou "admin"
  sender: "seguranca" | "sistema" | "adm";
  category: InboxMessageCategory;
  title: string;
  body: string;
  metadata?: {
    deviceInfo?: string;
    attemptedAt?: string;
    ipHint?: string;
    medalId?: string;
    medalTitle?: string;
    medalRarity?: string;
    studentId?: string;
    studentNick?: string;
    studentFullName?: string;
    studentSchool?: string;
    pioneerRank?: number;
    [key: string]: unknown;
  };
  read: boolean;
  createdAt: string;
}

const INBOX_STORAGE_KEY = "desafios_inbox_messages_v1";
export const ADMIN_NOTIFICATIONS_SHARED_GROUP_ID = "SEMED_ADMIN_NOTIFICATIONS_V1";

let memoryInboxMessages: SystemInboxMessage[] = [];

export function clearMemoryInboxMessages(): void {
  memoryInboxMessages = [];
}

export function loadAllInboxMessages(): SystemInboxMessage[] {
  if (typeof window === "undefined") {
    return [...memoryInboxMessages];
  }
  try {
    const raw = window.localStorage.getItem(INBOX_STORAGE_KEY);
    if (!raw) return [...memoryInboxMessages];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [...memoryInboxMessages];
  }
}

export function saveAllInboxMessages(messages: SystemInboxMessage[]): void {
  const trimmed = messages.slice(0, 300);
  memoryInboxMessages = [...trimmed];
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(INBOX_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.warn("Falha ao salvar caixa de mensagens:", err);
  }
}

export function createInboxMessage(
  data: Omit<SystemInboxMessage, "id" | "createdAt" | "read"> & { id?: string; createdAt?: string }
): SystemInboxMessage {
  const msg: SystemInboxMessage = {
    id: data.id ?? `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    recipientId: data.recipientId,
    sender: data.sender,
    category: data.category,
    title: data.title,
    body: data.body,
    metadata: data.metadata,
    read: false,
    createdAt: data.createdAt ?? new Date().toISOString(),
  };

  const all = loadAllInboxMessages();
  all.unshift(msg);
  saveAllInboxMessages(all);

  // Dispara evento no navegador para notificacoes em tempo real
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("desafios:inbox-message-received", {
        detail: msg,
      })
    );
  }

  return msg;
}

export function getInboxMessagesForRecipient(recipientId: string): SystemInboxMessage[] {
  const all = loadAllInboxMessages();
  const clean = recipientId.toLowerCase().trim();
  return all.filter((m) => m.recipientId.toLowerCase().trim() === clean);
}

export function markInboxMessageAsRead(messageId: string): void {
  const all = loadAllInboxMessages();
  let changed = false;
  for (const m of all) {
    if (m.id === messageId && !m.read) {
      m.read = true;
      changed = true;
    }
  }
  if (changed) {
    saveAllInboxMessages(all);
  }
}

export function markAllInboxMessagesAsReadForRecipient(recipientId: string): void {
  const all = loadAllInboxMessages();
  const clean = recipientId.toLowerCase().trim();
  let changed = false;
  for (const m of all) {
    if (m.recipientId.toLowerCase().trim() === clean && !m.read) {
      m.read = true;
      changed = true;
    }
  }
  if (changed) {
    saveAllInboxMessages(all);
  }
}

/**
 * Cria notificacao de seguranca de tentativa / login em segundo aparelho
 */
export function recordDeviceSecurityAlert(args: {
  studentNick: string;
  studentFullName: string;
  studentId: string;
  deviceInfo?: string;
  timestamp?: number;
}): { studentMsg: SystemInboxMessage; adminMsg: SystemInboxMessage } {
  const now = args.timestamp ? new Date(args.timestamp) : new Date();
  const timeFormatted = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const dateFormatted = now.toLocaleDateString("pt-BR");

  // Mensagem para o aluno
  const studentMsg = createInboxMessage({
    recipientId: args.studentId,
    sender: "seguranca",
    category: "seguranca_acesso",
    title: "Alerta de Segurança: Acesso em outro aparelho",
    body: `Sua conta foi conectada em outro dispositivo às ${timeFormatted} de ${dateFormatted}. Se não foi você, procure a coordenação escolar ou seu professor.`,
    metadata: {
      deviceInfo: args.deviceInfo || "Navegador Web",
      attemptedAt: now.toISOString(),
      studentNick: args.studentNick,
      studentId: args.studentId,
    },
  });

  // Mensagem para o ADM
  const adminMsg = createInboxMessage({
    recipientId: "admin",
    sender: "seguranca",
    category: "seguranca_acesso",
    title: `Tentativa de acesso simultâneo: ${args.studentNick}`,
    body: `O aluno ${args.studentFullName} (${args.studentNick}) registrou uma conexão em um novo aparelho às ${timeFormatted} de ${dateFormatted}, encerrando a sessão anterior.`,
    metadata: {
      deviceInfo: args.deviceInfo || "Navegador Web",
      attemptedAt: now.toISOString(),
      studentNick: args.studentNick,
      studentFullName: args.studentFullName,
      studentId: args.studentId,
    },
  });

  return { studentMsg, adminMsg };
}
