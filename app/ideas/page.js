import { supabaseServer } from '@/lib/supabaseServer';
import IdeaStream from '@/components/IdeaStream';
import PageHeader from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

async function getIdeas() {
  const db = supabaseServer();
  const { data } = await db
    .from('content_ideas')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(60);
  return data || [];
}

export default async function IdeasPage() {
  const ideas = await getIdeas();

  return (
    <div className="space-y-6">
      <PageHeader title="Ideas">
        A director, a writer and a growth lead, briefed on what is actually being discussed today.
        Five land every morning at 6am.
      </PageHeader>
      <IdeaStream initialIdeas={ideas} />
    </div>
  );
}
