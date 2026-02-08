'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@clerk/nextjs';
import { formatDistanceToNow } from 'date-fns';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

interface ConversationViewProps {
  conversationId: string;
  otherUser: {
    clerk_id: string;
    username: string;
  };
  onBack?: () => void;
  onMessagesRead?: () => void;
}

export function ConversationView({ conversationId, otherUser, onBack, onMessagesRead }: ConversationViewProps) {
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const supabase = createClient();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Fetch messages
  useEffect(() => {
    async function fetchMessages() {
      const { data, error } = await supabase
        .from('conversation_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
      } else {
        setMessages(data || []);
        
        // Mark messages as read
        if (user && data && data.length > 0) {
          const unreadIds = data
            .filter(m => m.sender_id !== user.id && !m.read_at)
            .map(m => m.id);
          
          if (unreadIds.length > 0) {
            await supabase
              .from('conversation_messages')
              .update({ read_at: new Date().toISOString() })
              .in('id', unreadIds);
            onMessagesRead?.();
          }
        }
      }
      setIsLoading(false);
    }

    fetchMessages();
  }, [conversationId, user, supabase, onMessagesRead]);

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel(`dm-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => [...prev, newMsg]);
          
          // Mark as read if from other user
          if (user && newMsg.sender_id !== user.id) {
            await supabase
              .from('conversation_messages')
              .update({ read_at: new Date().toISOString() })
              .eq('id', newMsg.id);
            onMessagesRead?.();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversation_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updated = payload.new as Message;
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? updated : m))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, user, supabase, onMessagesRead]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim() || !user || isSending) return;

    setIsSending(true);

    const { error: msgError } = await supabase.from('conversation_messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: newMessage.trim(),
    });

    if (msgError) {
      console.error('Error sending message:', msgError);
    } else {
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);
      
      setNewMessage('');
    }
    setIsSending(false);
    inputRef.current?.focus();
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  // Delete own message
  const handleDelete = async (msgId: string) => {
    if (deletingId) return;
    setDeletingId(msgId);
    await supabase.from('conversation_messages').delete().eq('id', msgId);
    setDeletingId(null);
    onMessagesRead?.();
  };

  // Edit own message
  const startEdit = (msg: Message) => {
    setEditingId(msg.id);
    setEditContent(msg.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editContent.trim()) return;
    await supabase
      .from('conversation_messages')
      .update({ content: editContent.trim() })
      .eq('id', editingId);
    setEditingId(null);
    setEditContent('');
    onMessagesRead?.();
  };

  const formatTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch {
      return '';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-casino-gold"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-casino-gold/20 bg-casino-black/30 flex items-center gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="text-casino-gold hover:text-yellow-400 md:hidden"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <div>
          <h3 className="font-semibold text-white">{otherUser.username}</h3>
          <p className="text-xs text-casino-gray">Direct Message</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-casino-gray py-8">
            <p>No messages yet</p>
            <p className="text-sm">Say hello to {otherUser.username}!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwnMessage = msg.sender_id === user?.id;
            const isDeleting = deletingId === msg.id;
            const isEditing = editingId === msg.id;
            return (
              <div
                key={msg.id}
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} group`}
              >
                <div
                  className={`max-w-[75%] rounded-lg px-3 py-2 ${
                    isOwnMessage
                      ? 'bg-casino-gold text-black'
                      : 'bg-casino-black/60 text-white border border-casino-gold/10'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="space-y-2">
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') cancelEdit();
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSaveEdit();
                              }
                            }}
                            className="w-full min-h-[60px] px-2 py-1.5 bg-black/20 border border-black/30 rounded text-sm text-black placeholder-black/50 focus:outline-none focus:border-black/50 resize-none"
                            placeholder="Edit message..."
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleSaveEdit}
                              disabled={!editContent.trim()}
                              className="text-xs font-semibold px-2 py-1 bg-black/30 rounded hover:bg-black/40 disabled:opacity-50"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="text-xs font-semibold px-2 py-1 bg-black/30 rounded hover:bg-black/40"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm wrap-break-word whitespace-pre-wrap">{msg.content}</p>
                          <div className={`flex items-center gap-1 mt-1 ${isOwnMessage ? 'justify-end' : ''}`}>
                            <p
                              className={`text-xs ${
                                isOwnMessage ? 'text-black/60' : 'text-casino-gray'
                              }`}
                            >
                              {formatTime(msg.created_at)}
                            </p>
                            {isOwnMessage && msg.read_at && (
                              <span className="text-xs text-black/60">✓✓</span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                    {isOwnMessage && !isEditing && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => startEdit(msg)}
                          className="p-1 rounded hover:bg-black/20 text-black/70 hover:text-black"
                          title="Edit message"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(msg.id)}
                          disabled={isDeleting}
                          className="p-1 rounded hover:bg-black/20 text-black/70 hover:text-black disabled:opacity-50"
                          title="Delete message"
                        >
                          {isDeleting ? (
                            <LoadingSpinner size="sm" className="block!" />
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t border-casino-gold/20">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={`Message ${otherUser.username}...`}
            rows={1}
            className="flex-1 min-h-[40px] max-h-32 px-4 py-2 bg-casino-black/60 border border-casino-gold/20 rounded-lg text-white placeholder-casino-gray focus:outline-none focus:border-casino-gold resize-none"
            disabled={isSending}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || isSending}
            className="shrink-0 h-10 w-16 flex items-center justify-center bg-casino-gold text-black font-semibold rounded-lg hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSending ? <LoadingSpinner size="sm" className="block! text-black" /> : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
}
