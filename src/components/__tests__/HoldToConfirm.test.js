import { fireEvent } from '@testing-library/react';
import HoldToConfirm from '../HoldToConfirm';

describe('HoldToConfirm', () => {
    let component, callback;

    beforeEach(() => {
        // Allow fast forwarding
        jest.useFakeTimers();

        // Create new mock callback for each test
        callback = jest.fn();

        // Render component
        component = render(
            <HoldToConfirm
                callback={callback}
                timeout={2500}
                buttonText='Hold to delete'
                tooltipText='Hold for 2.5 seconds to delete'
            />
        );
    });

    // Clean up pending timers after each test
    afterEach(() => {
        jest.runAllTimers();
        jest.useRealTimers();
    });

    it('runs callback when the button is clicked and held for timeout ms', () => {
        // Simulate user clicking and holding button
        const button = component.getByRole('button');
        fireEvent.mouseDown(button);

        // Fast forward timeout ms, confirm callback ran
        act(() => {
            jest.advanceTimersByTime(2500);
        });
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('does NOT run callback when button is clicked and held for less than timeout ms', () => {
        // Simulate user clicking and holding button
        const button = component.getByRole('button');
        fireEvent.mouseDown(button);

        // Fast forward less than timeout ms, release button
        act(() => {
            jest.advanceTimersByTime(2400);
        });
        fireEvent.mouseUp(button);

        // Fast forward timeout ms to confirm timer did not keep running
        act(() => {
            jest.advanceTimersByTime(2500);
        });

        // Confirm callback did NOT run
        expect(callback).not.toHaveBeenCalled();
    });

    it('does NOT run callback when button is clicked and not held', () => {
        // Simulate user clicking button normally, confirm callback did NOT run
        fireEvent.click(component.getByRole('button'));
        expect(callback).not.toHaveBeenCalled();

        // Fast forward timeout ms to confirm timer did not keep running
        act(() => {
            jest.advanceTimersByTime(2500);
        });

        // Confirm callback still did not run
        expect(callback).not.toHaveBeenCalled();
    });
});
