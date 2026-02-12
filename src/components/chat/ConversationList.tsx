'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@clerk/nextjs';
import { formatDistanceToNow } from 'date-fns';

interface Conversation {
  id: string;
  participant_1: string;
  participant_2: string;
  league_id: string;
  last_message_at: string;
  created_at: string;
  other_user?: {
    clerk_id: string;
    username: string;
  };
  unread_count?: number;
}

interface LeagueMember {
  clerk_id: string;
  username: string;
}

interface ConversationListProps {
  leagueId: string;
  onSelectConversation: (conversationId: string, otherUser: { clerk_id: string; username: string }) => void;
  selectedConversationId?: string;
  refreshKey?: number;
}

export function ConversationList({ leagueId, onSelectConversation, selectedConversationId, refreshKey }: ConversationListProps) {
  const { user } = useUser();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [leagueMembers, setLeagueMembers] = useState<LeagueMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewDM, setShowNewDM] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const supabase = createClient();

  // Fetch conversations and league members
  useEffect(() => {
    if (!user) return;

    async function fetchData() {
      // Fetch conversations where user is a participant
      const userId = user?.id;
      if (!userId) return;
      
      const { data: convos, error: convosError } = await supabase
        .from('conversations')
        .select('*')
        .eq('league_id', leagueId)
        .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
        .order('last_message_at', { ascending: false });

      if (convosError) {
        console.error('Error fetching conversations:', convosError);
      }

      // Fetch league members for starting new conversations
      const { data: members, error: membersError } = await supabase
        .from('profiles')
        .select('clerk_id, username')
        .eq('active_league_id', leagueId);

      if (membersError) {
        console.error('Error fetching members:', membersError);
      }

      // Get other user info for each conversation
      const conversationsWithUsers = await Promise.all(
        (convos || []).map(async (conv) => {
          const otherUserId = conv.participant_1 === userId ? conv.participant_2 : conv.participant_1;
          const otherUser = members?.find(m => m.clerk_id === otherUserId);
          
          // Count unread messages
          const { count } = await supabase
            .from('conversation_messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .neq('sender_id', userId)
            .is('read_at', null);

          return {
            ...conv,
            other_user: otherUser || { clerk_id: otherUserId, username: 'Unknown' },
            unread_count: count || 0,
          };
        })
      );

      setConversations(conversationsWithUsers);
      setLeagueMembers((members || []).filter(m => m.clerk_id !== userId));
      setIsLoading(false);
    }

    fetchData();
  }, [user, leagueId, supabase, refreshKey]);

  // Start a new conversation
  const startConversation = async (member: LeagueMember) => {
    if (!user) return;

    // Check if conversation already exists
    const existing = conversations.find(
      c => (c.participant_1 === member.clerk_id || c.participant_2 === member.clerk_id)
    );

    if (existing) {
      onSelectConversation(existing.id, member);
      setShowNewDM(false);
      return;
    }

    // Create new conversation
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        participant_1: user.id,
        participant_2: member.clerk_id,
        league_id: leagueId,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating conversation:', error);
      return;
    }

    const newConv: Conversation = {
      ...data,
      other_user: member,
      unread_count: 0,
    };

    setConversations([newConv, ...conversations]);
    onSelectConversation(data.id, member);
    setShowNewDM(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-casino-gold"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-casino-gold/20 flex justify-between items-center">
        <h3 className="text-sm font-semibold text-white">Direct Messages</h3>
        <button
          onClick={() => setShowNewDM(!showNewDM)}
          className="text-casino-gold hover:text-yellow-400 text-sm font-medium"
        >
          + New
        </button>
      </div>

      {/* New DM dropdown */}
      {showNewDM && (
        <div className="p-2 border-b border-casino-gold/20 bg-casino-black/40">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-xs text-casino-gray">Start conversation with:</p>
            <input
              type="text"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Search username..."
              className="flex-1 px-2 py-1 text-xs rounded bg-casino-black/70 border border-casino-gold/30 text-white placeholder-casino-gray focus:outline-none focus:border-casino-gold"
            />
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {leagueMembers.length === 0 ? (
              <p className="text-xs text-casino-gray">No other members in league</p>
            ) : (
              leagueMembers
                .filter((member) =>
                  member.username
                    ?.toLowerCase()
                    .includes(memberSearch.trim().toLowerCase())
                )
                .map((member) => (
                <button
                  key={member.clerk_id}
                  onClick={() => startConversation(member)}
                  className="w-full text-left px-2 py-1.5 rounded text-sm text-white hover:bg-casino-gold/20 transition-colors"
                >
                  {member.username}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-4 text-center text-casino-gray text-sm">
            <p>No conversations yet</p>
            <p className="text-xs mt-1">Click + New to start one</p>
          </div>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => conv.other_user && onSelectConversation(conv.id, conv.other_user)}
              className={`w-full text-left p-3 border-b border-casino-gold/10 hover:bg-casino-gold/10 transition-colors ${
                selectedConversationId === conv.id ? 'bg-casino-gold/20' : ''
              }`}
            >
              <div className="flex justify-between items-start">
                <span className="font-medium text-white text-sm">
                  {conv.other_user?.username || 'Unknown'}
                </span>
                {(conv.unread_count ?? 0) > 0 && (
                  <span className="bg-casino-gold text-black text-xs font-bold px-1.5 py-0.5 rounded-full">
                    {conv.unread_count}
                  </span>
                )}
              </div>
              <p className="text-xs text-casino-gray mt-0.5">
                {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true })}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
