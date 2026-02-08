'use client';

import { useState, useCallback } from 'react';
import { LeagueChat } from './LeagueChat';
import { ConversationList } from './ConversationList';
import { ConversationView } from './ConversationView';

interface ChatContainerProps {
  leagueId: string;
  leagueName: string;
}

type Tab = 'league' | 'dms';

interface SelectedConversation {
  id: string;
  otherUser: {
    clerk_id: string;
    username: string;
  };
}

export function ChatContainer({ leagueId, leagueName }: ChatContainerProps) {
  const [activeTab, setActiveTab] = useState<Tab>('league');
  const [selectedConversation, setSelectedConversation] = useState<SelectedConversation | null>(null);
  const [conversationsRefreshKey, setConversationsRefreshKey] = useState(0);

  const handleSelectConversation = (conversationId: string, otherUser: { clerk_id: string; username: string }) => {
    setSelectedConversation({ id: conversationId, otherUser });
  };

  const handleMessagesRead = useCallback(() => {
    setConversationsRefreshKey((k) => k + 1);
  }, []);

  const handleBackToList = () => {
    setSelectedConversation(null);
  };

  return (
    <div className="bg-casino-black/50 rounded-lg border border-casino-gold/20 overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-casino-gold/20">
        <button
          onClick={() => {
            setActiveTab('league');
            setSelectedConversation(null);
          }}
          className={`flex-1 px-4 py-3 text-sm font-semibold transition-all duration-200 ease-out ${
            activeTab === 'league'
              ? 'text-casino-gold border-b-2 border-casino-gold bg-casino-gold/10'
              : 'text-casino-gray hover:text-white hover:bg-casino-gold/5'
          }`}
        >
          🏆 League Chat
        </button>
        <button
          onClick={() => setActiveTab('dms')}
          className={`flex-1 px-4 py-3 text-sm font-semibold transition-all duration-200 ease-out ${
            activeTab === 'dms'
              ? 'text-casino-gold border-b-2 border-casino-gold bg-casino-gold/10'
              : 'text-casino-gray hover:text-white hover:bg-casino-gold/5'
          }`}
        >
          💬 Direct Messages
        </button>
      </div>

      {/* Content */}
      <div className="h-[500px] overflow-hidden">
        {activeTab === 'league' ? (
          <LeagueChat leagueId={leagueId} leagueName={leagueName} />
        ) : (
          <div className="flex h-full">
            {/* Conversation list - hidden on mobile when conversation selected */}
            <div className={`w-full md:w-64 border-r border-casino-gold/20 ${
              selectedConversation ? 'hidden md:block' : ''
            }`}>
              <ConversationList
                leagueId={leagueId}
                onSelectConversation={handleSelectConversation}
                selectedConversationId={selectedConversation?.id}
                refreshKey={conversationsRefreshKey}
              />
            </div>

            {/* Conversation view */}
            <div className={`flex-1 ${!selectedConversation ? 'hidden md:flex' : 'flex'}`}>
              {selectedConversation ? (
                <div className="w-full">
                  <ConversationView
                    conversationId={selectedConversation.id}
                    otherUser={selectedConversation.otherUser}
                    onBack={handleBackToList}
                    onMessagesRead={handleMessagesRead}
                  />
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-casino-gray">
                  <div className="text-center">
                    <p className="text-lg">Select a conversation</p>
                    <p className="text-sm mt-1">or start a new one</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-casino-gold/20 bg-casino-black/30">
        <p className="text-xs text-casino-gray text-center">
          {activeTab === 'league' 
            ? `Messages visible to all ${leagueName} members`
            : 'Private messages between you and another member'
          }
        </p>
      </div>
    </div>
  );
}
