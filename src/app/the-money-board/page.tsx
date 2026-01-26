import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export default async function TheMoneyBoardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth');
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          The Money Board
        </h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="w-full overflow-hidden" style={{ height: '600px' }}>
            <div style={{ 
              transform: 'scale(0.75)', 
              transformOrigin: 'top left',
              width: '133.33%',
              height: '133.33%'
            }}>
              <iframe 
                src="https://docs.google.com/spreadsheets/d/e/2PACX-1vTecKBhuY8WNibIiprccOrj7jXqxouPcK5QgnQphyc_ealkISLSU_co1fuzPID8qnXmz-gVfYFR0ina/pubhtml?gid=2031372717&amp;single=true&amp;widget=true&amp;headers=false"
                className="w-full h-full border-0 rounded"
                title="The Money Board"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
