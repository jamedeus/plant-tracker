import React, { useEffect } from 'react';
import { fireEvent } from '@testing-library/react';
import LazyModal, { useModal } from '../LazyModal';

/* eslint react/prop-types: 0 */

// Test parent component that renders button for each method exposed by useModal
function TestComponent({ title, loader }) {
    const modal = useModal();

    return (
        <>
            <button onClick={modal.open}>
                Open LazyModal
            </button>
            <button onClick={() => modal.open({ textProp: 'received text prop' })}>
                Open with props
            </button>
            <button onClick={modal.close}>
                Close LazyModal
            </button>

            <LazyModal
                ref={modal.ref}
                title={title}
                load={loader}
            />
        </>
    );
}

// Test body component that registers onClose callback and renders textProp if given
function TestBody({ close, setOnClose, textProp }) {
    // Use to check if function passed to setOnClose was called
    const onCloseSpy = TestBody.onCloseSpy;

    useEffect(() => {
        setOnClose(() => onCloseSpy && onCloseSpy());
    }, [setOnClose]);

    return (
        <div data-testid="lazy-loaded-body">
            {textProp && textProp}
            <button onClick={close}>
                Close from body
            </button>
        </div>
    );
}

// Returns TestBody immediately (no lazy load)
const immediateLoader = () => Promise.resolve({ default: TestBody });

describe('LazyModal', () => {
    beforeEach(() => {
        jest.useFakeTimers({ doNotFake: ['Date'] });
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    it('opens and closes when useModal open and close method are called', async () => {
        // Render TestBody component inside LazyModal
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        const component = render(<TestComponent loader={immediateLoader} />);

        // Confirm LazyModal is not rendered
        expect(component.queryByTestId('lazy-loaded-body')).toBeNull();

        // Open modal by clicking button rendered by parent, confirm rendered
        await user.click(component.getByText('Open LazyModal'));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(component.getByTestId('lazy-loaded-body')).toBeInTheDocument();

        // Close modal by clicking button rendered by parent, confirm unmounted
        await user.click(component.getByText('Close LazyModal'));
        await act(async () => await jest.advanceTimersByTimeAsync(400));
        expect(component.queryByTestId('lazy-loaded-body')).toBeNull();
    });

    it('shows loading spinner until body lazy loads, then renders body', async () => {
        // Render LazyModal with loader that doesn't resolve until resolveModule called
        let resolveModule;
        const delayedLoader = () => new Promise((resolve) => {
            resolveModule = resolve;
        });
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        const component = render(<TestComponent loader={delayedLoader} />);

        // Open modal, confirm spinner rendered, body did not
        await user.click(component.getByText('Open LazyModal'));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(document.querySelector('.loading')).not.toBeNull();
        expect(component.queryByTestId('lazy-loaded-body')).toBeNull();

        // Simulate lazy load completing
        await act(async () => resolveModule({ default: TestBody }));

        // Confirm spinner disappeared, body rendered
        expect(document.querySelector('.loading')).toBeNull();
        expect(component.getByTestId('lazy-loaded-body')).toBeInTheDocument();
    });

    it('renders title h3 if prop given', async () => {
        // Render LazyModal with title prop
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        const component = render(<TestComponent title="Modal Title" loader={immediateLoader} />);

        // Confirm title is not in document before modal renders
        expect(component.queryByText('Modal Title')).toBeNull();

        // Open modal by clicking button rendered by parent, confirm rendered
        await user.click(component.getByText('Open LazyModal'));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(component.getByTestId('lazy-loaded-body')).toBeInTheDocument();

        // Confirm title h3 has text passed to title prop
        expect(component.getByText('Modal Title')).toBeInTheDocument();
        expect(component.getByText('Modal Title').nodeName.toLowerCase()).toBe('h3');
    });

    it('passes props given to useModal open method to lazy loaded component', async () => {
        // Render TestBody component inside LazyModal
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        const component = render(<TestComponent loader={immediateLoader} />);

        // Confirm LazyModal is not rendered, text prop value not rendered
        expect(component.queryByTestId('lazy-loaded-body')).toBeNull();
        expect(component.queryByText('received text prop')).toBeNull();

        // Open modal by clicking button that calls useModal open method with props
        await user.click(component.getByText('Open with props'));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(component.getByTestId('lazy-loaded-body')).toBeInTheDocument();

        // Confirm lazy loaded body component received text prop
        expect(component.getByText('received text prop')).toBeInTheDocument();
    });

    it('calls functions passed to setOnClose when modal closes', async () => {
        // Get mock function passed to setOnClose to check if it was called
        TestBody.onCloseSpy = jest.fn();
        // Render TestBody component inside LazyModal
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        const component = render(<TestComponent title="Title" loader={immediateLoader} />);

        // Open modal by clicking button rendered by parent, confirm rendered
        await user.click(component.getByText('Open LazyModal'));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(component.getByTestId('lazy-loaded-body')).toBeInTheDocument();

        // Confirm setOnClose callback was not called yet
        expect(TestBody.onCloseSpy).not.toHaveBeenCalled();

        // Click LazyModal close button, confirm setOnClose callback ran
        await user.click(component.getByLabelText('Close modal'));
        expect(TestBody.onCloseSpy).toHaveBeenCalledTimes(1);

        // Wait for close animation, confirm modal unmounted
        await act(async () => await jest.advanceTimersByTimeAsync(400));
        expect(component.queryByTestId('lazy-loaded-body')).toBeNull();

        // Open modal again
        await user.click(component.getByText('Open LazyModal'));
        expect(component.getByTestId('lazy-loaded-body')).toBeInTheDocument();

        // Click close button rendered by child, confirm setOnClose callback ran again
        await user.click(component.getByText('Close from body'));
        expect(TestBody.onCloseSpy).toHaveBeenCalledTimes(2);

        // Wait for close animation, confirm modal unmounted
        await act(async () => await jest.advanceTimersByTimeAsync(400));
        expect(component.queryByTestId('lazy-loaded-body')).toBeNull();
    });

    it('closes when user presses escape key, does not close for other keys', async () => {
        // Get mock function passed to setOnClose to check if it was called
        TestBody.onCloseSpy = jest.fn();
        // Render TestBody component inside LazyModal
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        const component = render(<TestComponent loader={immediateLoader} />);

        // Open modal by clicking button rendered by parent, confirm rendered
        await user.click(component.getByText('Open LazyModal'));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(component.getByTestId('lazy-loaded-body')).toBeInTheDocument();

        // Confirm modal has modal-open class (starts open animation)
        expect(document.querySelector('.modal-open')).not.toBeNull();

        // Simulate user pressing Escape key, confirm setOnClose callback ran
        await user.keyboard('{Escape}');
        expect(TestBody.onCloseSpy).toHaveBeenCalledTimes(1);

        // Confirm modal-open class was removed (starts close animation)
        expect(document.querySelector('.modal-open')).toBeNull();

        // Fast forward through animation, confirm modal unmounted
        await act(async () => await jest.advanceTimersByTimeAsync(400));
        expect(component.queryByTestId('lazy-loaded-body')).toBeNull();

        // Open modal again, confirm rendered
        await user.click(component.getByText('Open LazyModal'));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(component.getByTestId('lazy-loaded-body')).toBeInTheDocument();

        // Simulate user pressing Backspace key, confirm setOnClose callback did NOT run
        await user.keyboard('{Backspace}');
        expect(TestBody.onCloseSpy).toHaveBeenCalledTimes(1);
    });

    it('closes when user swipes down from title, but not from body', async () => {
        // Get mock function passed to setOnClose to check if it was called
        TestBody.onCloseSpy = jest.fn();
        // Render TestBody component inside LazyModal
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        const component = render(<TestComponent loader={immediateLoader} />);

        // Open modal by clicking button rendered by parent, confirm rendered
        await user.click(component.getByText('Open LazyModal'));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(component.getByTestId('lazy-loaded-body')).toBeInTheDocument();
        // Confirm modal has modal-open class (starts open animation)
        expect(document.querySelector('.modal-open')).not.toBeNull();

        // Simulate user swiping down from modal body
        const body = component.getByTestId('lazy-loaded-body');
        fireEvent.touchStart(body, {touches: [{ clientX: 50, clientY: 0 }]});
        fireEvent.touchMove(body, {touches: [{ clientX:  50, clientY: 50 }]});
        fireEvent.touchEnd(body, {changedTouches: [{ clientX:  50, clientY: 50 }]});

        // Confirm setOnClose callback did NOT run
        expect(TestBody.onCloseSpy).toHaveBeenCalledTimes(0);

        // Simulate user swiping down from modal title
        const title = component.getByTestId('modal-swipe-hitbox');
        fireEvent.touchStart(title, {touches: [{ clientX: 50, clientY: 0 }]});
        fireEvent.touchMove(title, {touches: [{ clientX:  50, clientY: 50 }]});
        fireEvent.touchEnd(title, {changedTouches: [{ clientX:  50, clientY: 50 }]});

        // Confirm setOnClose callback ran
        expect(TestBody.onCloseSpy).toHaveBeenCalledTimes(1);
    });
});
