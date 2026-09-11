import { describe, expect, it } from 'vitest';
import { answerAsPlainText, announcedText } from './answerText';

const ANSWER = `## Måloppnåelse

Første avsnitt med en kilde [1]. Og en til [12].

### Hovedmål

- Sikre nett
- God konkurranse

| Tema | 2022 | 2023 |
| --- | --- | --- |
| Avvik | Kvartalsvis | Kvartalsvis |

Siste avsnitt.`;

describe('answerAsPlainText', () => {
  it('drops the citation markers', () => {
    const text = answerAsPlainText('Et svar [1] med to [23] markører.');
    expect(text).toBe('Et svar med to markører.');
  });

  it('keeps heading and list text but not their marks', () => {
    const text = answerAsPlainText(ANSWER);
    expect(text).toContain('Måloppnåelse');
    expect(text).not.toContain('## ');
    expect(text).toContain('Sikre nett');
    expect(text).not.toContain('- Sikre nett');
  });

  it('turns table rows into tab separated columns and drops the rule', () => {
    const text = answerAsPlainText(ANSWER);
    expect(text).toContain('Tema\t2022\t2023');
    expect(text).not.toContain('---');
  });
});

describe('announcedText', () => {
  it('says nothing before the first finished paragraph', () => {
    expect(announcedText('Svaret har så vidt begy')).toBe('');
  });

  it('stops at the last blank line, so half a sentence is never read out', () => {
    const streaming = 'Første avsnitt.\n\nAndre avsnitt er ikke ferd';
    expect(announcedText(streaming)).toBe('Første avsnitt.');
  });

  it('grows as paragraphs finish', () => {
    const one = announcedText('Ett.\n\nTo er underveis');
    const two = announcedText('Ett.\n\nTo.\n\nTre er underveis');
    expect(two.length).toBeGreaterThan(one.length);
    expect(two).toContain('To.');
  });
});
