import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Clarification } from './Clarification';
import { CLARIFICATION_COPIED, CLARIFICATION_COPY, CLARIFICATION_TAG } from './text';

const question = [
  'Jeg trenger litt mer for å svare godt på dette.',
  '',
  'Mener du måloppnåelsen i årsrapportene, eller målene i tildelingsbrevene [1]?',
].join('\n');

describe('Clarification', () => {
  it('frames the question as a question, in Norwegian', () => {
    render(<Clarification question={question} />);

    expect(screen.getByText(CLARIFICATION_TAG)).toBeTruthy();
    expect(screen.getByText(/Jeg trenger litt mer/u)).toBeTruthy();
  });

  it('leaves a bracketed number as text, because nothing was retrieved', () => {
    render(<Clarification question={question} />);

    // No search ran, so there is no excerpt behind «[1]» to link to.
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText(/tildelingsbrevene \[1\]/u)).toBeTruthy();
  });

  it('offers only the copy action', () => {
    render(<Clarification question={question} />);

    const buttons = screen.getAllByRole('button').map((button) => button.textContent);
    expect(buttons).toEqual([CLARIFICATION_COPY]);
  });

  it('copies the question without its markup, and says so', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

    render(<Clarification question={question} />);
    fireEvent.click(screen.getByRole('button', { name: CLARIFICATION_COPY }));

    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText.mock.calls[0]![0]).not.toContain('[1]');
    expect(await screen.findByText(CLARIFICATION_COPIED)).toBeTruthy();

    vi.unstubAllGlobals();
  });
});
