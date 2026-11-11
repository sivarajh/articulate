import { describe, expect, it } from 'vitest';
import type { DrillId } from '../types';
import { passageWords } from '../analysis/metrics';
import { DRILLS, buildDaily, buildDrill, buildFramework, buildImpromptu, planMinutes, seededRng } from './drills';
import { FRAMEWORKS } from './frameworks';
import { CATEGORIES, PROMPTS, promptsFor, promptsIn } from './prompts';

describe('content library', () => {
  it('has prompts for every category and no duplicates', () => {
    for (const category of CATEGORIES) expect(promptsIn(category.id).length).toBeGreaterThanOrEqual(10);
    const texts = PROMPTS.map((p) => p.text);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('has practice prompts for every framework', () => {
    for (const framework of FRAMEWORKS) {
      expect(promptsFor(framework.id).length).toBeGreaterThanOrEqual(3);
      expect(framework.example.answer.length).toBe(framework.steps.length);
    }
  });
});

describe('drill builders', () => {
  it('builds a runnable plan for every drill in the catalogue', () => {
    for (const drill of DRILLS) {
      const plan = buildDrill(drill.id, seededRng(drill.id));
      expect(plan.steps.length).toBeGreaterThan(0);
      for (const step of plan.steps) {
        expect(step.drillId).toBe(drill.id);
        expect(step.speakSec).toBeGreaterThan(0);
        expect(step.prompt.length).toBeGreaterThan(5);
        if (step.mode === 'read') expect(passageWords(step.readText!).length).toBeGreaterThan(5);
      }
      expect(new Set(plan.steps.map((s) => s.id)).size).toBe(plan.steps.length);
    }
  });

  it('gives multi-step drills the right shape', () => {
    const shrink = buildDrill('shrink-it', seededRng('a'));
    expect(shrink.steps.map((s) => s.speakSec)).toEqual([60, 30, 12]);
    expect(new Set(shrink.steps.map((s) => s.prompt)).size).toBe(1);
    expect(shrink.rapid).toBe(false);

    const hotSeat = buildDrill('hot-seat', seededRng('b'));
    expect(hotSeat.steps.length).toBe(5);
    expect(hotSeat.rapid).toBe(true);
    expect(new Set(hotSeat.steps.map((s) => s.prompt)).size).toBe(5);
    expect(hotSeat.steps.every((s) => s.prepSec === 0)).toBe(true);
  });

  it('includes the target word itself in a taboo card', () => {
    const [card] = buildDrill('taboo', seededRng('c')).steps;
    expect(card!.taboo!.length).toBe(6);
    expect(card!.prompt.toLowerCase()).toContain(card!.taboo![0]!);
  });

  it('times a pace passage to fit inside the take', () => {
    for (let i = 0; i < 8; i++) {
      const [step] = buildDrill('pace-lock', seededRng(`pace${i}`)).steps;
      const words = passageWords(step!.readText!).length;
      // Even at a slow 120 wpm the passage must fit in the allotted time.
      expect((words / 120) * 60).toBeLessThanOrEqual(step!.speakSec);
    }
  });

  it('makes framework practice guided', () => {
    const plan = buildFramework('star', seededRng('d'));
    expect(plan.steps[0]).toMatchObject({ drillId: 'framework', frameworkId: 'star', guided: true });
  });

  it('suggests the framework that suits an impromptu prompt', () => {
    const auto = buildImpromptu({ category: 'tough', speakSec: 60, prepSec: 0, framework: 'auto' }, seededRng('e'));
    expect(['abc', 'wsn']).toContain(auto.steps[0]!.frameworkId);
    const none = buildImpromptu({ category: 'tough', speakSec: 60, prepSec: 0, framework: 'none' }, seededRng('e'));
    expect(none.steps[0]!.frameworkId).toBeUndefined();
  });
});

describe('daily workout', () => {
  it('is the same all day and different the next day', () => {
    const shape = (key: string) => buildDaily(key, null).steps.map((s) => `${s.drillId}:${s.prompt}:${s.readText ?? ''}`);
    expect(shape('2026-03-10')).toEqual(shape('2026-03-10'));
    expect(shape('2026-03-10')).not.toEqual(shape('2026-03-11'));
  });

  it('is a warm-up, a focus drill and an impromptu', () => {
    for (let day = 1; day <= 28; day++) {
      const plan = buildDaily(`2026-02-${String(day).padStart(2, '0')}`, null);
      expect(plan.steps.length).toBe(3);
      expect(['tongue-twister', 'pace-lock']).toContain(plan.steps[0]!.drillId);
      expect(plan.steps[1]!.drillId).not.toBe(plan.steps[0]!.drillId);
      expect(plan.steps[2]!.drillId).toBe('impromptu');
      expect(planMinutes(plan)).toBeLessThanOrEqual(8);
    }
  });

  it('aims at the weakest skill most days', () => {
    const focus: DrillId[] = [];
    for (let day = 1; day <= 28; day++) {
      focus.push(buildDaily(`2026-02-${String(day).padStart(2, '0')}`, 'vocabulary').steps[1]!.drillId);
    }
    const aimed = focus.filter((id) => id === 'word-weave').length;
    expect(aimed).toBeGreaterThanOrEqual(17);
    expect(aimed).toBeLessThan(28);
  });
});
