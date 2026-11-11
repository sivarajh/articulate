import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { TakeReport } from '../components/TakeReport';
import { buildCustom, repeatPlan } from '../lib/content/drills';
import { when } from '../lib/format';
import { setPlan } from '../lib/session';
import { deleteTake, useStore } from '../lib/store';

export function Review() {
  const { takeId } = useParams();
  const navigate = useNavigate();
  const take = useStore((s) => s.takes.find((t) => t.id === takeId));
  if (!take) return <Navigate to="/progress" replace />;

  const { exercise } = take;
  const again = () => {
    setPlan(repeatPlan({ id: '', title: take.planTitle, steps: [exercise] }));
    navigate('/session');
  };
  const followUp = (question: string) => {
    setPlan(buildCustom([question], { speakSec: 60, prepSec: 10, title: 'Follow-up' }));
    navigate('/session');
  };
  const remove = () => {
    if (!window.confirm('Delete this take and its recording?')) return;
    deleteTake(take.id);
    navigate('/progress', { replace: true });
  };

  return (
    <div className="page">
      <header className="page-head">
        <Link to="/progress" className="link" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
          <Icon name="arrow-left" size={16} />
          History
        </Link>
        <div className="eyebrow">
          {exercise.title} · {exercise.tag} · {when(take.at)}
        </div>
        <h1 className="title" style={{ fontSize: 'clamp(24px, 3vw, 32px)' }}>
          {exercise.prompt}
        </h1>
        <div className="row-wrap" style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-primary" onClick={again}>
            <Icon name="retry" size={16} />
            Practise this again
          </button>
          <button type="button" className="btn btn-danger" onClick={remove}>
            <Icon name="trash" size={16} />
            Delete
          </button>
        </div>
      </header>
      <TakeReport take={take} onFollowUp={followUp} />
    </div>
  );
}
