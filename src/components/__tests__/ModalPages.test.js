import React from 'react';
import { fireEvent } from '@testing-library/react';
import ModalPages from '../ModalPages';

describe('ModalPages', () => {
    beforeEach(() => {
        jest.useFakeTimers({ doNotFake: ['Date'] });
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    const renderModalPages = () => {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        const component = render(
            <ModalPages>
                <div>Page One</div>
                <div>Page Two</div>
                <div>Page Three</div>
            </ModalPages>
        );

        const track = component.getByTestId('modal-pages-track');
        const backButton = component.getByTestId('modal-pages-back');
        const nextButton = component.getByTestId('modal-pages-next');

        return {
            ...component,
            user,
            track,
            backButton,
            nextButton
        };
    };

    // Fast forward 300ms and fire transitionEnd event to simulate transform
    const finishTransition = async (track) => {
        await act(async () => await jest.advanceTimersByTimeAsync(300));
        act(() => fireEvent.transitionEnd(track));
    };

    it('fades out the back button when the first page is visible', async () => {
        const { user, backButton, track } = renderModalPages();

        // Confirm back button is not visible on first page
        expect(backButton).toHaveClass('opacity-0');
        expect(backButton).toHaveAttribute('aria-disabled', 'true');

        // Confirm clicking hidden back button does nothing
        await user.click(backButton);
        expect(track).toHaveStyle('transform: translateX(-0%)');
    });

    it('fades out the next button when the last page is visible', async () => {
        const { user, track, nextButton } = renderModalPages();

        // Go to last page
        await user.click(nextButton);
        await finishTransition(track);
        await user.click(nextButton);
        await finishTransition(track);

        // Confirm next button is not visible on last page
        expect(nextButton).toHaveClass('opacity-0');
        expect(nextButton).toHaveAttribute('aria-disabled', 'true');

        // Confirm clicking hidden next button does nothing
        await user.click(nextButton);
        expect(track).toHaveStyle('transform: translateX(-200%)');
    });

    it('shows both buttons when the current page is neither first nor last', async () => {
        const { user, track, backButton, nextButton } = renderModalPages();

        // Go to second page
        await user.click(nextButton);
        await finishTransition(track);

        // Confirm both next and back buttons are visible
        expect(backButton).not.toHaveClass('opacity-0');
        expect(backButton).toHaveAttribute('aria-disabled', 'false');
        expect(nextButton).not.toHaveClass('opacity-0');
        expect(nextButton).toHaveAttribute('aria-disabled', 'false');
    });

    it('updates track transform to slide to correct page when buttons clicked', async () => {
        const { user, track, backButton, nextButton } = renderModalPages();

        // Confirm first page is visible (no transform)
        expect(track).toHaveStyle('transform: translateX(-0%)');

        // Go to page 2, confirm track slide page 2 into view
        await user.click(nextButton);
        expect(track).toHaveStyle('transform: translateX(-100%)');
        await finishTransition(track);

        // Go to page 3, confirm track slide page 3 into view
        await user.click(nextButton);
        expect(track).toHaveStyle('transform: translateX(-200%)');
        await finishTransition(track);

        // Go back to page 2, confirm track slide page 2 into view
        await user.click(backButton);
        expect(track).toHaveStyle('transform: translateX(-100%)');
        await finishTransition(track);
    });

    it('does not change pages if user clicks buttons during transition', async () => {
        const { user, track, backButton, nextButton } = renderModalPages();

        // Click next button, confirm track started sliding
        await user.click(nextButton);
        expect(track).toHaveStyle('transform: translateX(-100%)');

        // Fast forward half way through transition
        await act(async () => await jest.advanceTimersByTimeAsync(150));

        // Click next button again, confirm track transform did not change
        await user.click(nextButton);
        expect(track).toHaveStyle('transform: translateX(-100%)');

        // Click back button, confirm track transform did not change
        await user.click(backButton);
        expect(track).toHaveStyle('transform: translateX(-100%)');

        // Fast forward through whole transition
        await finishTransition(track);

        // Click next button, confirm track transform DID change
        await user.click(nextButton);
        expect(track).toHaveStyle('transform: translateX(-200%)');
    });
});
