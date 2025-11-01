import React, { useState, useMemo } from 'react';
import { fireEvent } from '@testing-library/react';
import HoldToConfirm from '../HoldToConfirm';

describe('HoldToConfirm', () => {
    let component, callback, onHoldStart, onHoldStop;

    /* eslint-disable react/prop-types */
    const TestComponent = ({callback, timeout, buttonText, tooltipText}) => {
        const [holding, setHolding] = useState(false);

        // Memoize so call count doesn't reset when component rerenders
        onHoldStart = useMemo(() => jest.fn(() => setHolding(true)), []);
        onHoldStop = useMemo(() => jest.fn(() => setHolding(false)), []);

        return (
            <div>
                {holding && <div>User holding button</div>}
                <HoldToConfirm
                    callback={callback}
                    timeout={timeout}
                    buttonText={buttonText}
                    tooltipText={tooltipText}
                    onHoldStart={onHoldStart}
                    onHoldStop={onHoldStop}
                />
            </div>
        );
    };

    beforeEach(() => {
        // Allow fast forwarding
        jest.useFakeTimers({ doNotFake: ['Date'] });

        // Create new mock callback for each test
        callback = jest.fn();

        // Render component
        component = render(
            <TestComponent
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
        fireEvent.pointerDown(button);

        // Fast forward timeout ms, confirm callback ran
        act(() => jest.advanceTimersByTime(2500));
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('does NOT run callback when button is clicked and held for less than timeout ms', () => {
        // Simulate user clicking and holding button
        const button = component.getByRole('button');
        fireEvent.pointerDown(button);

        // Fast forward less than timeout ms, release button
        act(() => jest.advanceTimersByTime(2400));
        fireEvent.pointerUp(button);

        // Fast forward timeout ms to confirm timer did not keep running
        act(() => jest.advanceTimersByTime(2500));

        // Confirm callback did NOT run
        expect(callback).not.toHaveBeenCalled();
    });

    it('does NOT run callback when button is clicked and not held', () => {
        // Simulate user clicking button normally, confirm callback did NOT run
        fireEvent.click(component.getByRole('button'));
        expect(callback).not.toHaveBeenCalled();

        // Fast forward timeout ms to confirm timer did not keep running
        act(() => jest.advanceTimersByTime(2500));

        // Confirm callback still did not run
        expect(callback).not.toHaveBeenCalled();
    });

    it('runs onHoldStart and onHoldStop callback when button clicked and released', () => {
        // Confirm onHoldStart and onHoldStop callbacks not called yet
        expect(onHoldStart).not.toHaveBeenCalled();
        expect(onHoldStop).not.toHaveBeenCalled();

        // Simulate user clicking and holding button
        const button = component.getByRole('button');
        fireEvent.pointerDown(button);

        // Confirm tooltip appears and onHoldStart callback runs immediately
        expect(component.container.querySelector(
            '[data-tip="Hold for 2.5 seconds to delete"]'
        ).classList).toContain('tooltip-open');
        expect(component.queryByText('User holding button')).not.toBeNull();
        expect(onHoldStart).toHaveBeenCalled();

        // Simulate user releasing button
        fireEvent.pointerUp(button);

        // Confirm that tooltip doesn't disappear immediately
        act(() => jest.advanceTimersByTime(100));
        expect(component.container.querySelector(
            '[data-tip="Hold for 2.5 seconds to delete"]'
        ).classList).toContain('tooltip-open');
        expect(onHoldStop).not.toHaveBeenCalled();

        // Wait for tooltip timeout, confirm disappeared + onHoldStop callback ran
        act(() => jest.advanceTimersByTime(750));
        expect(component.container.querySelector(
            '[data-tip="Hold for 2.5 seconds to delete"]'
        ).classList).not.toContain('tooltip-open');
        expect(component.queryByText('User holding button')).toBeNull();
        expect(onHoldStop).toHaveBeenCalled();
    });

    it('does NOT run onHoldStop callback when user is not holding button', () => {
        // Confirm onHoldStop callback not called
        expect(onHoldStop).not.toHaveBeenCalled();

        // Simulate user moving cursor over button without clicking
        const button = component.getByRole('button');
        fireEvent.mouseEnter(button);
        fireEvent.mouseLeave(button);
        act(() => jest.advanceTimersByTime(750));

        // Confirm onHoldStop callback did NOT run
        expect(onHoldStop).not.toHaveBeenCalled();

        // Simulate user starting click outside button
        fireEvent.pointerDown(component.container.querySelector('div'));
        // Simulate user moving cursor over button and releasing click
        fireEvent.mouseEnter(button);
        fireEvent.pointerUp(button);
        act(() => jest.advanceTimersByTime(750));

        // Confirm onHoldStop callback did NOT run
        expect(onHoldStop).not.toHaveBeenCalled();
    });

    it('behaves like normal button when timeout is 0', () => {
        // Render HoldToConfirm with 0ms timeout
        const noDelay = render(
            <HoldToConfirm
                callback={callback}
                timeout={0}
                buttonText='Delete'
            />
        );

        // Simulate user clicking button normally, confirm callback runs
        const button = noDelay.getByRole('button', {name: 'Delete'});
        fireEvent.click(button);
        jest.advanceTimersByTime(0);
        expect(callback).toHaveBeenCalled();
    });

    it('does NOT run callback when touch user presses button and then moves finger outside', () => {
        // Mock button bounding box to predictable values
        const button = component.getByRole('button');
        button.getBoundingClientRect = jest.fn(() => ({
            left: 0,
            right: 100,
            top: 0,
            bottom: 50
        }));

        // Simulate touch screen user pressing button then moving finger outside
        fireEvent.pointerDown(button);
        fireEvent.touchMove(button, {
            touches: [{ clientX: 200, clientY: 200 }]
        });

        // Fast forward timeout ms while holding touch
        act(() => jest.advanceTimersByTime(2500));

        // Confirm callback did NOT run
        expect(callback).not.toHaveBeenCalled();
    });

    it('runs callback when touch user presses button, moves finger outside, and moves back', () => {
        // Mock button bounding box to predictable values
        const button = component.getByRole('button');
        button.getBoundingClientRect = jest.fn(() => ({
            left: 0,
            right: 100,
            top: 0,
            bottom: 50
        }));

        // Simulate touch screen user pressing button then moving finger outside
        fireEvent.pointerDown(button);
        fireEvent.touchMove(button, {
            touches: [{ clientX: 200, clientY: 200 }]
        });

        // Move finger back inside to restart
        fireEvent.touchMove(button, {
            touches: [{ clientX: 10, clientY: 10 }]
        });

        // Fast forward less than timeout ms while holding touch
        act(() => jest.advanceTimersByTime(1500));

        // Move finger again without leaving button
        fireEvent.touchMove(button, {
            touches: [{ clientX: 15, clientY: 10 }]
        });

        // Fast forward rest of timeout ms while holding touch
        act(() => jest.advanceTimersByTime(1500));

        // Confirm callback ran
        expect(callback).toHaveBeenCalledTimes(1);
    });
});
