import { getProfile } from '@/lib/auth/profile';
import { createServiceClient } from '@/lib/supabase/service';
import { redirect } from 'next/navigation';
import { ChatContainer } from '@/components/chat/ChatContainer';

export default async function ChatPage() {
  const profile = await getProfile();
  
  if (!profile) {
    redirect('/auth/sign-in');
  }

  if (!profile.active_league_id) {
    redirect('/leagues');
  }

  // Get league name
  const supabase = createServiceClient();
  const { data: league } = await supabase
    .from('leagues')
    .select('name')
    .eq('id', profile.active_league_id)
    .single();

  return (
    <div className="min-h-screen bg-gradient-to-b from-casino-black via-slate-950 to-casino-black">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-6">
            <span className="text-casino-gold">League</span> Chat
          </h1>
          
          <ChatContainer 
            leagueId={profile.active_league_id} 
            leagueName={league?.name || 'Your League'}
          />
        </div>
      </div>
    </div>
  );
}
