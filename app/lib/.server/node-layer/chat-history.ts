import type { Message } from 'ai';
import type { Actor } from './auth';
import { getServiceSupabaseClient } from './supabase';

export interface ChatSessionSummary {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
}

export interface ChatSessionWithMessages extends ChatSessionSummary {
  messages: Message[];
}

function normalizeRole(role: unknown): 'user' | 'assistant' | 'system' {
  if (role === 'user' || role === 'assistant' || role === 'system') {
    return role;
  }

  return 'assistant';
}

function normalizeContent(content: unknown) {
  if (typeof content === 'string') {
    return content;
  }

  try {
    return JSON.stringify(content);
  } catch {
    return '';
  }
}

function inferSessionTitle(messages: Message[]) {
  const firstUserMessage = messages.find((message) => message.role === 'user');

  if (!firstUserMessage) {
    return null;
  }

  const text = normalizeContent(firstUserMessage.content).trim().replace(/\s+/g, ' ');

  if (text.length === 0) {
    return null;
  }

  return text.slice(0, 120);
}

export async function listChatSessions(actor: Actor): Promise<ChatSessionSummary[] | null> {
  const supabase = getServiceSupabaseClient();

  if (!supabase || actor.isAnonymous) {
    return null;
  }

  const { data, error } = await supabase
    .from('chat_sessions')
    .select('id, title, created_at, updated_at, last_message_at')
    .eq('user_id', actor.userId)
    .is('deleted_at', null)
    .order('last_message_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastMessageAt: row.last_message_at,
  }));
}

export async function createChatSession(actor: Actor, title?: string | null): Promise<ChatSessionSummary | null> {
  const supabase = getServiceSupabaseClient();

  if (!supabase || actor.isAnonymous) {
    return null;
  }

  const nowIso = new Date().toISOString();
  const normalizedTitle = title?.trim() || null;

  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({
      user_id: actor.userId,
      title: normalizedTitle,
      updated_at: nowIso,
      last_message_at: nowIso,
    })
    .select('id, title, created_at, updated_at, last_message_at')
    .single();

  if (error) {
    throw error;
  }

  return {
    id: data.id,
    title: data.title,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    lastMessageAt: data.last_message_at,
  };
}

export async function isChatSessionOwnedByActor(actor: Actor, sessionId: string): Promise<boolean | null> {
  const supabase = getServiceSupabaseClient();

  if (!supabase || actor.isAnonymous) {
    return null;
  }

  const { data, error } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', actor.userId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data?.id);
}

export async function getChatSessionWithMessages(actor: Actor, sessionId: string): Promise<ChatSessionWithMessages | null> {
  const supabase = getServiceSupabaseClient();

  if (!supabase || actor.isAnonymous) {
    return null;
  }

  const { data: session, error: sessionError } = await supabase
    .from('chat_sessions')
    .select('id, title, created_at, updated_at, last_message_at')
    .eq('id', sessionId)
    .eq('user_id', actor.userId)
    .is('deleted_at', null)
    .maybeSingle();

  if (sessionError) {
    throw sessionError;
  }

  if (!session) {
    return null;
  }

  const { data: rows, error: rowsError } = await supabase
    .from('chat_messages')
    .select('seq, role, content, metadata')
    .eq('session_id', sessionId)
    .eq('user_id', actor.userId)
    .order('seq', { ascending: true });

  if (rowsError) {
    throw rowsError;
  }

  const messages = (rows ?? []).map((row) => {
    const raw = (row.metadata as { raw?: Message } | null)?.raw;

    if (raw && typeof raw === 'object') {
      return raw;
    }

    return {
      id: `message_${row.seq}`,
      role: normalizeRole(row.role),
      content: row.content,
    } satisfies Message;
  });

  return {
    id: session.id,
    title: session.title,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
    lastMessageAt: session.last_message_at,
    messages,
  };
}

export async function syncChatMessages(actor: Actor, sessionId: string, messages: Message[]) {
  const supabase = getServiceSupabaseClient();

  if (!supabase || actor.isAnonymous) {
    return null;
  }

  const hasAccess = await isChatSessionOwnedByActor(actor, sessionId);

  if (!hasAccess) {
    return false;
  }

  const nowIso = new Date().toISOString();

  const { error: deleteError } = await supabase
    .from('chat_messages')
    .delete()
    .eq('session_id', sessionId)
    .eq('user_id', actor.userId);

  if (deleteError) {
    throw deleteError;
  }

  if (messages.length > 0) {
    const rows = messages.map((message, index) => ({
      session_id: sessionId,
      user_id: actor.userId,
      seq: index,
      role: normalizeRole(message.role),
      content: normalizeContent(message.content),
      metadata: {
        raw: message,
      },
    }));

    const { error: insertError } = await supabase.from('chat_messages').insert(rows);

    if (insertError) {
      throw insertError;
    }
  }

  const { error: updateError } = await supabase
    .from('chat_sessions')
    .update({
      title: inferSessionTitle(messages),
      updated_at: nowIso,
      last_message_at: nowIso,
    })
    .eq('id', sessionId)
    .eq('user_id', actor.userId)
    .is('deleted_at', null);

  if (updateError) {
    throw updateError;
  }

  return true;
}

export async function softDeleteChatSession(actor: Actor, sessionId: string) {
  const supabase = getServiceSupabaseClient();

  if (!supabase || actor.isAnonymous) {
    return null;
  }

  const { error } = await supabase
    .from('chat_sessions')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('user_id', actor.userId)
    .is('deleted_at', null);

  if (error) {
    throw error;
  }

  return true;
}
