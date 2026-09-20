import { UserChatMessage } from '../types';

const CHAT_STORAGE_KEY = 'syd_team_user_chat_messages_v2';
const BOT_HISTORY_KEY = 'syd_ai_bot_chat_history_v1';

const INITIAL_TEAM_MESSAGES: UserChatMessage[] = [];

export const getStoredTeamMessages = (): UserChatMessage[] => {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) {
      saveStoredTeamMessages(INITIAL_TEAM_MESSAGES);
      return INITIAL_TEAM_MESSAGES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return INITIAL_TEAM_MESSAGES;
  } catch (e) {
    console.error('Error reading chat messages from storage', e);
    return INITIAL_TEAM_MESSAGES;
  }
};

export const saveStoredTeamMessages = (messages: UserChatMessage[]) => {
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    window.dispatchEvent(new CustomEvent('syd-team-chat-updated', { detail: messages }));
  } catch (e) {
    console.error('Error saving chat messages to storage', e);
  }
};

export const sendTeamChatMessage = (message: Omit<UserChatMessage, 'id' | 'timestamp'>): UserChatMessage => {
  const messages = getStoredTeamMessages();
  const newMsg: UserChatMessage = {
    ...message,
    id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isRead: false,
  };
  const updated = [...messages, newMsg];
  saveStoredTeamMessages(updated);
  return newMsg;
};

export const getConversationMessages = (currentUserId: string, targetRecipientId: string): UserChatMessage[] => {
  const all = getStoredTeamMessages();
  if (targetRecipientId === 'general') {
    return all.filter((m) => m.recipientId === 'general');
  }
  // Direct messages between current user and target user
  return all.filter(
    (m) =>
      (m.senderId === currentUserId && m.recipientId === targetRecipientId) ||
      (m.senderId === targetRecipientId && m.recipientId === currentUserId)
  );
};

export const markConversationAsRead = (currentUserId: string, targetRecipientId: string) => {
  const all = getStoredTeamMessages();
  let changed = false;
  const updated = all.map((m) => {
    if (
      m.recipientId === (targetRecipientId === 'general' ? 'general' : currentUserId) &&
      (targetRecipientId === 'general' || m.senderId === targetRecipientId) &&
      !m.isRead
    ) {
      changed = true;
      return { ...m, isRead: true };
    }
    return m;
  });

  if (changed) {
    saveStoredTeamMessages(updated);
  }
};

export const getUnreadMessagesCount = (currentUserId: string, targetRecipientId?: string): number => {
  const all = getStoredTeamMessages();
  if (targetRecipientId) {
    if (targetRecipientId === 'general') {
      return all.filter((m) => m.recipientId === 'general' && m.senderId !== currentUserId && !m.isRead).length;
    }
    return all.filter((m) => m.senderId === targetRecipientId && m.recipientId === currentUserId && !m.isRead).length;
  }
  return all.filter(
    (m) => (m.recipientId === 'general' || m.recipientId === currentUserId) && m.senderId !== currentUserId && !m.isRead
  ).length;
};
