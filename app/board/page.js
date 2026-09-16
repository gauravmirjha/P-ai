import BoardMeeting from '@/components/BoardMeeting';
import PageHeader from '@/components/ui/PageHeader';

export default function BoardPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="The board">
        Eight seats, one decision. They argue, and the Chair records who dissented.
      </PageHeader>
      <BoardMeeting />
    </div>
  );
}
