import { describe, expect, it } from 'vitest';
import { appendPastedImage } from './paste';
import type { WrongQuestionInput } from '../components/WrongQuestionForm';

function form(over: Partial<WrongQuestionInput> = {}): WrongQuestionInput {
  return {
    stem: '', stemImages: [], options: '', optionsImages: [],
    myAnswer: 'A', correctAnswer: 'B', knowledgePoint: '增长率', errorCause: '计算失误',
    tags: [], trickIds: [], ...over,
  };
}

describe('appendPastedImage', () => {
  it('appends to stemImages when target is stem, leaving optionsImages unchanged', () => {
    const prev = form({ stemImages: ['data:image/jpeg;base64,A'], optionsImages: ['data:image/jpeg;base64,B'] });
    const next = appendPastedImage(prev, 'stem', 'data:image/jpeg;base64,C');
    expect(next.stemImages).toEqual(['data:image/jpeg;base64,A', 'data:image/jpeg;base64,C']);
    expect(next.optionsImages).toEqual(['data:image/jpeg;base64,B']);
  });

  it('appends to optionsImages when target is options, leaving stemImages unchanged', () => {
    const prev = form({ stemImages: ['data:image/jpeg;base64,A'], optionsImages: ['data:image/jpeg;base64,B'] });
    const next = appendPastedImage(prev, 'options', 'data:image/jpeg;base64,C');
    expect(next.optionsImages).toEqual(['data:image/jpeg;base64,B', 'data:image/jpeg;base64,C']);
    expect(next.stemImages).toEqual(['data:image/jpeg;base64,A']);
  });

  it('returns a new state without mutating the original', () => {
    const prev = form({ stemImages: ['data:image/jpeg;base64,A'], optionsImages: ['data:image/jpeg;base64,B'] });
    const next = appendPastedImage(prev, 'stem', 'data:image/jpeg;base64,C');
    expect(next).not.toBe(prev);
    expect(prev.stemImages).toEqual(['data:image/jpeg;base64,A']);
    expect(prev.optionsImages).toEqual(['data:image/jpeg;base64,B']);
  });
});
