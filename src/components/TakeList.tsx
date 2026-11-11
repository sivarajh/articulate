import { Link } from 'react-router-dom';
import { when } from '../lib/format';
import type { TakeRecord } from '../lib/types';
import { Icon } from './Icon';

/** What to call a take in a list: the question asked, or the opening of the passage read. */
export function takeTitle(take: TakeRecord): string {
  const { exercise } = take;
  return exercise.mode === 'read' ? (exercise.readText ?? exercise.prompt) : exercise.prompt;
}

export function TakeList({ takes }: { takes: TakeRecord[] }) {
  return (
    <div className="list">
      {takes.map((take) => {
        const a = take.analysis;
        const facts = [when(take.at), take.exercise.title];
        if (a.wpm != null) facts.push(`${a.wpm} wpm`);
        if (a.sufficient && take.exercise.mode === 'speak') facts.push(a.fillers === 1 ? '1 filler' : `${a.fillers} fillers`);
        return (
          <Link key={take.id} to={`/review/${take.id}`} className="list-row">
            <div className="list-main">
              <div className="list-title">{takeTitle(take)}</div>
              <div className="list-meta">{facts.join(' · ')}</div>
            </div>
            <span className="list-score" aria-label={a.overall != null ? `Score ${a.overall}` : 'Not scored'}>
              {a.overall ?? '–'}
            </span>
            <Icon name="chevron-right" size={18} />
          </Link>
        );
      })}
    </div>
  );
}
