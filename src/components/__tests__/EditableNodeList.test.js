import EditableNodeList, { getSelectedItems } from '../EditableNodeList';
import { createEditableNodeListController } from '../editableNodeListController';

const DEFAULT_NODES = ['node-1', 'node-2', 'node-3'];

// Helper to simulate pointer events that supports pointerId (fireEvent doesn't)
// Uses MouseEvent instead of PointerEvent because jsdom hasn't implemented it
const firePointerEvent = (target, type, props) => {
    const eventProps = { bubbles: true, cancelable: true, ...props };
    const event = new window.MouseEvent(type, eventProps);
    if (props.pointerId !== undefined) {
        Object.defineProperty(event, 'pointerId', {
            configurable: true,
            value: props.pointerId
        });
    }
    fireEvent(target, event);
};

const renderTestComponent = (editing=true, nodes=DEFAULT_NODES) => {
    const controller = createEditableNodeListController();
    const component = render(
        <EditableNodeList editing={editing} controller={controller}>
            {nodes.map((name) => (
                <div key={name}>{name}</div>
            ))}
        </EditableNodeList>
    );
    return { ...component, controller: controller };
};

describe('EditableNodeList', () => {
    // Controls which element elementsFromPoint mock returns
    // Will return button if set to existing index, otherwise empty array
    let elementUnderCursorIndex = null;

    beforeEach(() => {
        jest.useFakeTimers({ doNotFake: ['Date'] });

        // Mock getBoundingClientRect to return list wrapper dimensions on iOS
        // (used by getIndexFromPoint to get center of list)
        Element.prototype.getBoundingClientRect = jest.fn(() => ({
            top: 100,
            bottom: 500,
            left: 46,
            right: 382,
            width: 336,
            height: 400
        }));

        // Mock document.elementsFromPoint to return the element with
        // data-editable-index attribute matching elementUnderCursorIndex
        elementUnderCursorIndex = null;
        document.elementsFromPoint = jest.fn(() => {
            const element = document.querySelector(
                `[data-editable-index="${elementUnderCursorIndex}"]`
            );
            return element ? [element] : [];
        });

        // Mock viewport dimensions
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 });
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 });
    });

    afterEach(() => {
        jest.runAllTimers();
        jest.useRealTimers();
    });

    it('selects/unselects node when clicked without dragging', async () => {
        // Render component, get overlay buttons that cover each node
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        const { container, controller } = renderTestComponent();
        const buttons = container.querySelectorAll('button');

        // Confirm nothing is selected
        expect(getSelectedItems(controller)).toEqual([]);

        // Click first button, confirm selected
        await user.click(buttons[0]);
        expect(getSelectedItems(controller)).toEqual(['node-1']);

        // Click second button, confirm selected
        await user.click(buttons[1]);
        expect(getSelectedItems(controller)).toEqual(['node-1', 'node-2']);

        // Click first button again, confirm unselected
        await user.click(buttons[0]);
        expect(getSelectedItems(controller)).toEqual(['node-2']);
    });

    it('selects multiple nodes when user clicks and drags', () => {
        // Render component, get overlay buttons that cover each node
        const { container, controller } = renderTestComponent();
        const buttons = container.querySelectorAll('button');

        // Simulate user starting click on first node
        elementUnderCursorIndex = 0;
        firePointerEvent(buttons[0], 'pointerdown', {
            pointerId: 7,
            button: 0,
            clientX: 200,
            clientY: 220
        });
        // Confirm first node selected immediately (before drag)
        expect(getSelectedItems(controller)).toEqual(['node-1']);

        // Simulate user dragging without leaving first node
        firePointerEvent(window, 'pointermove', {
            pointerId: 7,
            clientX: 205,
            clientY: 240
        });
        // Confirm selection did not change
        expect(getSelectedItems(controller)).toEqual(['node-1']);

        // Simulate user dragging down to third node
        elementUnderCursorIndex = 2;
        firePointerEvent(window, 'pointermove', {
            pointerId: 7,
            clientX: 210,
            clientY: 360
        });
        // Confirm all 3 nodes are now selected
        expect(getSelectedItems(controller)).toEqual(['node-1', 'node-2', 'node-3']);

        // Simulate user releasing click, moving mouse back to top (no click)
        firePointerEvent(window, 'pointerup', { pointerId: 7 });
        elementUnderCursorIndex = 0;
        firePointerEvent(window, 'pointermove', {
            pointerId: 7,
            clientX: 200,
            clientY: 220
        });
        // Confirm selection did not change
        expect(getSelectedItems(controller)).toEqual(['node-1', 'node-2', 'node-3']);
    });

    it('unselects multiple nodes when user clicks and drags', () => {
        // Render component, get overlay buttons that cover each node
        const { container, controller } = renderTestComponent();
        const buttons = container.querySelectorAll('button');

        // Select all nodes using controller
        act(() => controller.replace(new Set(['node-1', 'node-2', 'node-3'])));

        // Simulate user starting click on first node
        elementUnderCursorIndex = 0;
        firePointerEvent(buttons[0], 'pointerdown', {
            pointerId: 7,
            button: 0,
            clientX: 200,
            clientY: 220
        });
        // Confirm first node unselected immediately (before drag)
        expect(getSelectedItems(controller)).toEqual(['node-2', 'node-3']);

        // Simulate user dragging down to third node
        elementUnderCursorIndex = 2;
        firePointerEvent(window, 'pointermove', {
            pointerId: 7,
            clientX: 210,
            clientY: 360
        });
        firePointerEvent(window, 'pointerup', { pointerId: 7 });
        // Confirm all 3 nodes are now unselected
        expect(getSelectedItems(controller)).toEqual([]);
    });

    it('ignores drag from second pointer (multitouch) when drag already in progress', () => {
        // Render component, get overlay buttons that cover each node
        const { container, controller } = renderTestComponent();
        const buttons = container.querySelectorAll('button');

        // Simulate user starting click on first node
        elementUnderCursorIndex = 0;
        firePointerEvent(buttons[0], 'pointerdown', {
            pointerId: 7,
            button: 0,
            clientX: 200,
            clientY: 220
        });
        // Confirm first node selected immediately (before drag)
        expect(getSelectedItems(controller)).toEqual(['node-1']);

        // Simulate user starting click with different pointer on first node
        firePointerEvent(buttons[2], 'pointerdown', {
            pointerId: 22,
            button: 0,
            clientX: 200,
            clientY: 220
        });
        // Confirm selection did not change (second click did not unselect)
        expect(getSelectedItems(controller)).toEqual(['node-1']);

        // Simulate second pointer dragging to third node
        elementUnderCursorIndex = 2;
        firePointerEvent(window, 'pointermove', {
            pointerId: 22,
            clientX: 200,
            clientY: 360
        });
        // Confirm selection still did not change (no drag for second click)
        expect(getSelectedItems(controller)).toEqual(['node-1']);

        // Simulate second pointer ending click, confirm selection did not change
        firePointerEvent(window, 'pointerup', { pointerId: 22 });
        expect(getSelectedItems(controller)).toEqual(['node-1']);

        // Simulate first pointer dragging to second node
        elementUnderCursorIndex = 1;
        firePointerEvent(window, 'pointermove', {
            pointerId: 7,
            clientX: 200,
            clientY: 300
        });
        firePointerEvent(window, 'pointerup', { pointerId: 7 });
        // Confirm first 2 nodes are now selected (first drag did not abort)
        expect(getSelectedItems(controller)).toEqual(['node-1', 'node-2']);
    });

    it('does not select nodes when editing is disabled', () => {
        // Render component with editing = false, get wrappers around nodes
        const { container, controller } = renderTestComponent(false);
        const wrappers = container.querySelectorAll('.flex.relative');

        // Confirm nothing is selected
        expect(getSelectedItems(controller)).toEqual([]);

        // Simulate user starting click on first node, dragging to third node
        elementUnderCursorIndex = 0;
        firePointerEvent(wrappers[0], 'pointerdown', {
            pointerId: 7,
            button: 0,
            clientX: 200,
            clientY: 220
        });
        elementUnderCursorIndex = 2;
        firePointerEvent(window, 'pointermove', {
            pointerId: 7,
            clientX: 210,
            clientY: 360
        });
        firePointerEvent(window, 'pointerup', { pointerId: 7 });

        // Confirm nothing is selected
        expect(getSelectedItems(controller)).toEqual([]);
    });
});

describe('EditableNodeList autoscroll', () => {
    // Mock enough nodes to make list scrollable
    const nodes = Array.from({ length: 20 }, (_, index) => `node-${index + 1}`);

    // Controls which element elementsFromPoint mock returns
    // Will return button if set to existing index, otherwise empty array
    let elementUnderCursorIndex;

    // Stores mock requestAnimationFrame id
    let rafId;
    // Stores array of objects with mock rafID and callback
    let rafQueue;
    // Runs next callback in rafQueue
    const runAnimationFrame = (timestamp) => {
        const frame = rafQueue.shift();
        if (!frame) {
            throw new Error('No animation frame scheduled');
        }
        frame.cb(timestamp);
    };

    beforeEach(() => {
        jest.useFakeTimers({ doNotFake: ['Date'] });

        // Mock getBoundingClientRect to return list wrapper dimensions on iOS
        // (used by getIndexFromPoint to get center of list)
        Element.prototype.getBoundingClientRect = jest.fn(() => ({
            top: 100,
            bottom: 500,
            left: 46,
            right: 382,
            width: 336,
            height: 400
        }));

        // Mock document.elementsFromPoint to return the element with
        // data-editable-index attribute matching elementUnderCursorIndex
        elementUnderCursorIndex = null;
        document.elementsFromPoint = jest.fn(() => {
            const element = document.querySelector(
                `[data-editable-index="${elementUnderCursorIndex}"]`
            );
            return element ? [element] : [];
        });

        // Mock viewport dimensions
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 });
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 });
        Object.defineProperty(document.documentElement, 'scrollHeight', {
            configurable: true,
            value: 4000
        });

        // Mock scrollBy to check how much page scrolled
        Object.defineProperty(window, 'scrollY', {
            configurable: true,
            writable: true,
            value: 300
        });
        window.scrollBy = jest.fn((_, y) => {
            window.scrollY += y;
        });

        // Clear mock requestAnimationFrame queue
        rafQueue = [];
        rafId = 0;

        // Mock requestAnimationFrame to add callback to mock queue
        global.requestAnimationFrame = jest.fn((cb) => {
            rafId += 1;
            rafQueue.push({ id: rafId, cb });
            return rafId;
        });
        // Mock cancelAnimationFrame to remove callback for given id from queue
        global.cancelAnimationFrame = jest.fn((id) => {
            rafQueue = rafQueue.filter((frame) => frame.id !== id);
        });
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();

        // Prevent realtimers running pending raf callback and failing next test
        global.requestAnimationFrame = jest.fn();
        global.cancelAnimationFrame = jest.fn();
    });

    it('scrolls document when pointer enters bottom scroll zone', () => {
        // Render component, get list element and parent + overlay buttons
        const { container, controller } = renderTestComponent(true, nodes);
        const list = container.querySelector('[data-editable-index="0"]').parentElement;
        const parent = list.parentElement;
        const buttons = container.querySelectorAll('button');

        // Simulate flex parent (greater than or equal to list height)
        Object.defineProperty(list, 'clientHeight', { configurable: true, value: 500 });
        Object.defineProperty(parent, 'clientHeight', { configurable: true, value: 700 });
        // Mock bounding rect for list and parent
        parent.getBoundingClientRect = jest.fn(() => ({
            top: 80,
            bottom: 920,
            left: 190,
            right: 610,
            width: 420,
            height: 840
        }));
        list.getBoundingClientRect = jest.fn(() => ({
            top: 80,
            bottom: 920,
            left: 200,
            right: 600,
            width: 400,
            height: 840
        }));

        // Simulate user starting click on first node
        elementUnderCursorIndex = 0;
        firePointerEvent(buttons[0], 'pointerdown', {
            pointerId: 1,
            button: 0,
            clientX: 240,
            clientY: 120
        });
        // Confirm first node selected immediately (before drag)
        expect(getSelectedItems(controller)).toEqual(['node-1']);

        // Simulate user moving cursor into bottom autoscroll zone
        elementUnderCursorIndex = 4;
        firePointerEvent(window, 'pointermove', {
            pointerId: 1,
            clientX: 240,
            clientY: 599
        });
        // Confirm all nodes cursor passed over were selected
        expect(getSelectedItems(controller)).toEqual([
            'node-1', 'node-2', 'node-3', 'node-4', 'node-5'
        ]);
        // Confirm requestAnimationFrame was called (start autoscroll loop)
        expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);

        // Run first animation frame (sets initial timestamp), confirm no scroll
        act(() => runAnimationFrame(1000));
        expect(window.scrollBy).not.toHaveBeenCalled();

        // Simulate next node scrolling into view (should happen in next frame)
        elementUnderCursorIndex = 6;
        // Run next animation frame 16ms later
        act(() => runAnimationFrame(1016));
        // Confirm page scrolled down 9.6px
        expect(window.scrollBy).toHaveBeenCalledTimes(1);
        const [, deltaY] = window.scrollBy.mock.calls[0];
        expect(deltaY).toBeCloseTo(9.6, 3);
        expect(window.scrollY).toBeCloseTo(309.6, 3);
        // Confirm node that moved into view was selected
        expect(getSelectedItems(controller)).toContain('node-7');
    });

    it('scrolls overflow container when pointer enters top scroll zone', () => {
        // Render component, get list element and parent + overlay buttons
        const { container, controller } = renderTestComponent(true, nodes);
        const list = container.querySelector('[data-editable-index="0"]').parentElement;
        const parent = list.parentElement;
        const buttons = container.querySelectorAll('button');

        // Simulate fixed-height parent with overflow (less than list height)
        Object.defineProperty(list, 'clientHeight', { configurable: true, value: 1200 });
        Object.defineProperty(parent, 'clientHeight', { configurable: true, value: 600 });
        Object.defineProperty(parent, 'scrollTop', { configurable: true, writable: true, value: 320 });
        Object.defineProperty(parent, 'scrollHeight', { configurable: true, value: 1600 });
        // Mock bounding rect for list and parent
        list.getBoundingClientRect = jest.fn(() => ({
            top: 0,
            bottom: 1200,
            left: 200,
            right: 600,
            width: 400,
            height: 1200
        }));
        parent.getBoundingClientRect = jest.fn(() => ({
            top: 0,
            bottom: 600,
            left: 190,
            right: 610,
            width: 420,
            height: 600
        }));

        // Simulate user starting click on 4th node
        elementUnderCursorIndex = 3;
        firePointerEvent(buttons[3], 'pointerdown', {
            pointerId: 3,
            button: 0,
            clientX: 240,
            clientY: 180
        });
        // Confirm first node selected immediately (before drag)
        expect(getSelectedItems(controller)).toEqual(['node-4']);

        // Simulate user moving cursor into top autoscroll zone
        elementUnderCursorIndex = 5;
        firePointerEvent(window, 'pointermove', {
            pointerId: 3,
            clientX: 240,
            clientY: 0
        });
        // Confirm requestAnimationFrame was called (start autoscroll loop)
        expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);

        // Run first animation frame (sets initial timestamp), confirm no scroll
        act(() => runAnimationFrame(2000));
        expect(parent.scrollTop).toBeCloseTo(320, 5);
        expect(window.scrollBy).not.toHaveBeenCalled();

        // Simulate node scrolling into view from above
        elementUnderCursorIndex = 2;
        // Run next animation frame 16ms later
        act(() => runAnimationFrame(2016));
        // Confirm overflow container scrolled up 9.6px, body did not scroll
        expect(parent.scrollTop).toBeCloseTo(310.4, 3);
        expect(window.scrollBy).not.toHaveBeenCalled();
        // Confirm node that moved into view was selected
        expect(getSelectedItems(controller)).toEqual(['node-3', 'node-4']);
    });
});
