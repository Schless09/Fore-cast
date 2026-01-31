'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@clerk/nextjs';
import { formatDistanceToNow } from 'date-fns';

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
  const inputRef = useRef<HTMLInputElement>(null);
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
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || isSending) return;

    setIsSending(true);

    // Insert message
    const { error: msgError } = await supabase.from('conversation_messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: newMessage.trim(),
    });

    if (msgError) {
      console.error('Error sending message:', msgError);
    } else {
      // Update conversation's last_message_at
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);
      
      setNewMessage('');
    }
    setIsSending(false);
    // Keep focus on input
    inputRef.current?.focus();
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
            return (
              <div
                key={msg.id}
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-lg px-3 py-2 ${
                    isOwnMessage
                      ? 'bg-casino-gold text-black'
                      : 'bg-casino-black/60 text-white border border-casino-gold/10'
                  }`}
                >
                  <p className="text-sm break-words">{msg.content}</p>
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
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t border-casino-gold/20">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={`Message ${otherUser.username}...`}
            className="flex-1 px-4 py-2 bg-casino-black/60 border border-casino-gold/20 rounded-lg text-white placeholder-casino-gray focus:outline-none focus:border-casino-gold"
            disabled={isSending}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || isSending}
            className="px-4 py-2 bg-casino-gold text-black font-semibold rounded-lg hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSending ? '...' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
}
