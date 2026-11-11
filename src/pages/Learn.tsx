import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { buildDrill, buildFramework, drillInfo } from '../lib/content/drills';
import { FRAMEWORKS } from '../lib/content/frameworks';
import { LESSONS } from '../lib/content/lessons';
import { setPlan } from '../lib/session';
import { SKILLS, type Plan } from '../lib/types';

export function Learn() {
  const navigate = useNavigate();
  const start = (plan: Plan) => {
    setPlan(plan);
    navigate('/session');
  };

  return (
    <div className="page">
      <header className="page-head">
        <span className="eyebrow">Learn</span>
        <h1 className="title">A dozen ideas do most of the work.</h1>
        <p className="lede">
          Each principle takes a minute to read and has a drill that trains it. Read one, then go and say something out
          loud.
        </p>
      </header>

      <section aria-labelledby="principles-title">
        <div className="section-head">
          <h2 className="section-title" id="principles-title">
            Principles
          </h2>
        </div>
        <div className="stack" style={{ gap: 10 }}>
          {LESSONS.map((lesson) => {
            const drill = lesson.drill === 'framework' ? null : drillInfo(lesson.drill);
            return (
              <details key={lesson.id} className="card fold">
                <summary>
                  <div>
                    <div className="card-title">{lesson.title}</div>
                    <div className="card-sub">{lesson.idea}</div>
                  </div>
                  <span className="tag" style={{ marginLeft: 'auto' }}>
                    {SKILLS.find((s) => s.id === lesson.skill)!.label}
                  </span>
                  <span className="chev" style={{ marginLeft: 0 }}>
                    <Icon name="chevron-right" size={18} />
                  </span>
                </summary>
                <div className="fold-body stack" style={{ gap: 14 }}>
                  {lesson.body.map((paragraph) => (
                    <p key={paragraph} style={{ maxWidth: '68ch' }}>
                      {paragraph}
                    </p>
                  ))}
                  <div className="grid grid-2">
                    <div>
                      <h3 className="subhead">Before</h3>
                      <p className="quote">{lesson.before}</p>
                    </div>
                    <div>
                      <h3 className="subhead">After</h3>
                      <p className="quote quote-good">{lesson.after}</p>
                    </div>
                  </div>
                  <div>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => start(drill ? buildDrill(drill.id) : buildFramework('pyramid'))}
                    >
                      <Icon name="mic" size={16} />
                      Practise: {drill ? drill.name : 'Answer first'}
                    </button>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      </section>

      <section className="section" aria-labelledby="fw-title">
        <div className="section-head">
          <div>
            <h2 className="section-title" id="fw-title">
              Frameworks
            </h2>
            <p className="section-sub">Shapes you can pour any answer into. Learn three or four until they are automatic.</p>
          </div>
        </div>
        <div className="stack" style={{ gap: 10 }}>
          {FRAMEWORKS.map((framework) => (
            <details key={framework.id} className="card fold">
              <summary>
                <div>
                  <div className="card-title">{framework.name}</div>
                  <div className="card-sub">{framework.tagline}</div>
                </div>
                <span className="chev">
                  <Icon name="chevron-right" size={18} />
                </span>
              </summary>
              <div className="fold-body stack" style={{ gap: 14 }}>
                <p style={{ maxWidth: '68ch' }}>
                  <strong>Use it when:</strong> {framework.useWhen}
                </p>
                <ol className="steps">
                  {framework.steps.map((step, i) => (
                    <li key={i}>
                      <div>
                        <div className="step-name">{step.name}</div>
                        <div className="step-cue">
                          {step.cue} <em>“{step.starter}”</em>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
                <div>
                  <h3 className="subhead">Example: {framework.example.prompt}</h3>
                  <div className="stack" style={{ gap: 8 }}>
                    {framework.example.answer.map((line, i) => (
                      <p key={i} className="quote quote-good">
                        <span className="tag" style={{ marginRight: 8 }}>
                          {framework.steps[i]!.name}
                        </span>
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
                <div>
                  <button type="button" className="btn btn-secondary" onClick={() => start(buildFramework(framework.id))}>
                    <Icon name="mic" size={16} />
                    Practise {framework.name}
                  </button>
                </div>
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
