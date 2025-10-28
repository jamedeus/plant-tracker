import { useState } from 'react';
import EditableNodeList from '../EditableNodeList';
import { createEditableNodeListController } from '../editableNodeListController';

const DEFAULT_NODES = ['node-1', 'node-2', 'node-3'];
// Mock enough nodes to make list scrollable
const SCROLL_NODES = Array.from({ length: 20 }, (_, index) => `node-${index + 1}`);

// Helper to simulate pointer events that supports pointerId (fireEvent doesn't)
// Uses MouseEvent instead of PointerEvent because jsdom hasn't implemented it
export const firePointerEvent = (target, type, props) => {
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

const renderTestComponent = (editing=true, nodes=DEFAULT_NODES, onStartEditing) => {
    const controller = createEditableNodeListController();
    const component = render(
        <EditableNodeList
            editing={editing}
            controller={controller}
            onStartEditing={onStartEditing}
        >
            {nodes.map((name) => (
                <div key={name}>{name}</div>
            ))}
        </EditableNodeList>
    );
    return { ...component, controller: controller };
};

// Takes container returned by renderTestComponent, returns parent and list
// elements with parent height mocked to match list (flex parent expands to fit)
const mockFlexParentBounds = (container) => {
    const list = container.querySelector('.flex.flex-col');
    const parent = list.parentElement;
    Object.defineProperty(list, 'clientHeight', { configurable: true, value: 500 });
    parent.getBoundingClientRect = jest.fn(() => ({
        top: 80,
        bottom: 920,
        left: 190,
        right: 610,
        width: 420,
        height: 840
    }));
    Object.defineProperty(parent, 'clientHeight', { configurable: true, value: 700 });
    list.getBoundingClientRect = jest.fn(() => ({
        top: 80,
        bottom: 920,
        left: 200,
        right: 600,
        width: 400,
        height: 840
    }));
    return { parent, list };
};

// Takes container returned by renderTestComponent, returns parent and list
// elements with greater list height than parent (fixed-height parent with overflow)
const mockFixedHeightParentBounds = (container) => {
    const list = container.querySelector('.flex.flex-col');
    const parent = list.parentElement;
    Object.defineProperty(list, 'clientHeight', { configurable: true, value: 1200 });
    Object.defineProperty(parent, 'clientHeight', { configurable: true, value: 600 });
    Object.defineProperty(parent, 'scrollTop', { configurable: true, writable: true, value: 320 });
    Object.defineProperty(parent, 'scrollHeight', { configurable: true, value: 1600 });
    parent.getBoundingClientRect = jest.fn(() => ({
        top: 0,
        bottom: 600,
        left: 190,
        right: 610,
        width: 420,
        height: 600
    }));
    list.getBoundingClientRect = jest.fn(() => ({
        top: 0,
        bottom: 1200,
        left: 200,
        right: 600,
        width: 400,
        height: 1200
    }));
    return { parent, list };
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
        expect(controller.getSnapshot()).toEqual(new Set());

        // Click first button, confirm selected
        await user.click(buttons[0]);
        expect(controller.getSnapshot()).toEqual(new Set(['node-1']));

        // Click second button, confirm selected
        await user.click(buttons[1]);
        expect(controller.getSnapshot()).toEqual(new Set(['node-1', 'node-2']));

        // Click first button again, confirm unselected
        await user.click(buttons[0]);
        expect(controller.getSnapshot()).toEqual(new Set(['node-2']));
    });

    it('toggles selection when pressing enter or space on focused item', () => {
        // Render component, get overlay button for first node
        const { container, controller } = renderTestComponent();
        const button = container.querySelector('button');

        // Confirm nothing is selected
        expect(controller.getSnapshot()).toEqual(new Set());

        // Press enter while button focused, confirm selected
        button.focus();
        fireEvent.keyDown(button, { key: 'Enter' });
        expect(controller.getSnapshot()).toEqual(new Set(['node-1']));

        // Press space while button focused, confirm unselected
        fireEvent.keyDown(button, { key: ' ' });
        expect(controller.getSnapshot()).toEqual(new Set());

        // Press other key, confirm selection does not change
        fireEvent.keyDown(button, { key: 'y' });
        expect(controller.getSnapshot()).toEqual(new Set());
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
        expect(controller.getSnapshot()).toEqual(new Set(['node-1']));

        // Simulate user dragging without leaving first node
        firePointerEvent(window, 'pointermove', {
            pointerId: 7,
            clientX: 205,
            clientY: 240
        });
        // Confirm selection did not change
        expect(controller.getSnapshot()).toEqual(new Set(['node-1']));

        // Simulate user dragging down to third node
        elementUnderCursorIndex = 2;
        firePointerEvent(window, 'pointermove', {
            pointerId: 7,
            clientX: 210,
            clientY: 360
        });
        // Confirm all 3 nodes are now selected
        expect(controller.getSnapshot()).toEqual(new Set(['node-1', 'node-2', 'node-3']));

        // Simulate user releasing click, moving mouse back to top (no click)
        firePointerEvent(window, 'pointerup', { pointerId: 7 });
        elementUnderCursorIndex = 0;
        firePointerEvent(window, 'pointermove', {
            pointerId: 7,
            clientX: 200,
            clientY: 220
        });
        // Confirm selection did not change
        expect(controller.getSnapshot()).toEqual(new Set(['node-1', 'node-2', 'node-3']));
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
        expect(controller.getSnapshot()).toEqual(new Set(['node-2', 'node-3']));

        // Simulate user dragging down to third node
        elementUnderCursorIndex = 2;
        firePointerEvent(window, 'pointermove', {
            pointerId: 7,
            clientX: 210,
            clientY: 360
        });
        firePointerEvent(window, 'pointerup', { pointerId: 7 });
        // Confirm all 3 nodes are now unselected
        expect(controller.getSnapshot()).toEqual(new Set([]));
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
        expect(controller.getSnapshot()).toEqual(new Set(['node-1']));

        // Simulate user starting click with different pointer on first node
        firePointerEvent(buttons[2], 'pointerdown', {
            pointerId: 22,
            button: 0,
            clientX: 200,
            clientY: 220
        });
        // Confirm selection did not change (second click did not unselect)
        expect(controller.getSnapshot()).toEqual(new Set(['node-1']));

        // Simulate second pointer dragging to third node
        elementUnderCursorIndex = 2;
        firePointerEvent(window, 'pointermove', {
            pointerId: 22,
            clientX: 200,
            clientY: 360
        });
        // Confirm selection still did not change (no drag for second click)
        expect(controller.getSnapshot()).toEqual(new Set(['node-1']));

        // Simulate second pointer ending click, confirm selection did not change
        firePointerEvent(window, 'pointerup', { pointerId: 22 });
        expect(controller.getSnapshot()).toEqual(new Set(['node-1']));

        // Simulate first pointer dragging to second node
        elementUnderCursorIndex = 1;
        firePointerEvent(window, 'pointermove', {
            pointerId: 7,
            clientX: 200,
            clientY: 300
        });
        firePointerEvent(window, 'pointerup', { pointerId: 7 });
        // Confirm first 2 nodes are now selected (first drag did not abort)
        expect(controller.getSnapshot()).toEqual(new Set(['node-1', 'node-2']));
    });

    it('does not select nodes when editing is disabled', () => {
        // Render component with editing = false, get wrappers around nodes
        const { container, controller } = renderTestComponent(false);
        const wrappers = container.querySelectorAll('.flex.relative');

        // Confirm nothing is selected
        expect(controller.getSnapshot()).toEqual(new Set([]));

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
        expect(controller.getSnapshot()).toEqual(new Set([]));
    });

    it('selects a range of nodes when user shift-clicks', async () => {
        // Render component, get overlay buttons that cover each node
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        const { container, controller } = renderTestComponent(true, SCROLL_NODES);
        const buttons = container.querySelectorAll('button');

        // Click second button, confirm selected
        await user.click(buttons[1]);
        expect(controller.getSnapshot()).toEqual(new Set(['node-2']));

        // Shift-click fourth button, confirm nodes between 2 and 4 are selected
        firePointerEvent(buttons[3], 'pointerdown', {
            pointerId: 32,
            button: 0,
            clientX: 210,
            clientY: 320,
            shiftKey: true
        });
        firePointerEvent(window, 'pointerup', { pointerId: 32 });
        expect(controller.getSnapshot()).toEqual(new Set(['node-2', 'node-3', 'node-4']));

        // Shift-click first button, confirm nodes between 1 and 2 are selected,
        // but nodes after 2 were unselected
        firePointerEvent(buttons[0], 'pointerdown', {
            pointerId: 33,
            button: 0,
            clientX: 210,
            clientY: 220,
            shiftKey: true
        });
        firePointerEvent(window, 'pointerup', { pointerId: 33 });
        expect(controller.getSnapshot()).toEqual(new Set(['node-1', 'node-2']));
    });

    it('extends drag selection in either direction when user shift-clicks', () => {
        // Render component, get overlay buttons that cover each node
        const { container, controller } = renderTestComponent(true, SCROLL_NODES);
        const buttons = container.querySelectorAll('button');

        // Simulate user starting click on third node, dragging to fifth node
        elementUnderCursorIndex = 2;
        firePointerEvent(buttons[2], 'pointerdown', {
            pointerId: 41,
            button: 0,
            clientX: 210,
            clientY: 300
        });
        elementUnderCursorIndex = 4;
        firePointerEvent(window, 'pointermove', {
            pointerId: 41,
            clientX: 210,
            clientY: 360
        });
        firePointerEvent(window, 'pointerup', { pointerId: 41 });
        // Confirm al 3 nodes are now selected
        expect(controller.getSnapshot()).toEqual(new Set(['node-3', 'node-4', 'node-5']));

        // Simulate user shift-clicking on seventh node (no drag)
        firePointerEvent(buttons[6], 'pointerdown', {
            pointerId: 42,
            button: 0,
            clientX: 210,
            clientY: 380,
            shiftKey: true
        });
        firePointerEvent(window, 'pointerup', { pointerId: 42 });
        // Confirm all nodes between existing range and 7 are selected
        expect(controller.getSnapshot()).toEqual(new Set([
            'node-3',
            'node-4',
            'node-5',
            'node-6',
            'node-7'
        ]));

        // Simulate user shift-clicking on first node (no drag)
        firePointerEvent(buttons[0], 'pointerdown', {
            pointerId: 43,
            button: 0,
            clientX: 210,
            clientY: 220,
            shiftKey: true
        });
        firePointerEvent(window, 'pointerup', { pointerId: 43 });
        // Confirm all nodes between existing range and 1 are selected, but
        // nodes from the first shift-click are unselected
        expect(controller.getSnapshot()).toEqual(new Set([
            'node-1',
            'node-2',
            'node-3',
            'node-4',
            'node-5'
        ]));
    });

    it('unselects a range of selected nodes when user shift-clicks', async () => {
        // Render component, get overlay buttons that cover each node
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        const { container, controller } = renderTestComponent(true, SCROLL_NODES);
        const buttons = container.querySelectorAll('button');

        // Click second, third, and fourth buttons (no drag)
        await user.click(buttons[1]);
        await user.click(buttons[2]);
        await user.click(buttons[3]);
        // Confirm all 3 nodes are now selected
        expect(controller.getSnapshot()).toEqual(new Set(['node-2', 'node-3', 'node-4']));

        // Click third button again (no drag), confirm unselected
        await user.click(buttons[3]);
        expect(controller.getSnapshot()).toEqual(new Set(['node-2', 'node-3']));

        // Shift-click first button, confirm all nodes are unselected
        firePointerEvent(buttons[0], 'pointerdown', {
            pointerId: 55,
            button: 0,
            clientX: 210,
            clientY: 220,
            shiftKey: true
        });
        firePointerEvent(window, 'pointerup', { pointerId: 55 });
        expect(controller.getSnapshot()).toEqual(new Set());
    });

    it('unselects drag-selected nodes when user shift-clicks over same range', async () => {
        // Render component, get overlay buttons that cover each node
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        const { container, controller } = renderTestComponent(true, SCROLL_NODES);
        const buttons = container.querySelectorAll('button');

        // Simulate user starting click on fourth node, dragging to eighth node
        elementUnderCursorIndex = 3;
        firePointerEvent(buttons[3], 'pointerdown', {
            pointerId: 61,
            button: 0,
            clientX: 210,
            clientY: 320
        });
        elementUnderCursorIndex = 7;
        firePointerEvent(window, 'pointermove', {
            pointerId: 61,
            clientX: 210,
            clientY: 420
        });
        firePointerEvent(window, 'pointerup', { pointerId: 61 });
        // Confirm all 5 nodes are selected
        expect(controller.getSnapshot()).toEqual(new Set([
            'node-4',
            'node-5',
            'node-6',
            'node-7',
            'node-8'
        ]));

        // Simulate user clicking (no drag) on eighth node, confirm unselected
        await user.click(buttons[7]);
        expect(controller.getSnapshot()).toEqual(new Set(['node-4', 'node-5', 'node-6', 'node-7']));

        // Simulate user shift-clicking on second node (no drag)
        firePointerEvent(buttons[1], 'pointerdown', {
            pointerId: 63,
            button: 0,
            clientX: 210,
            clientY: 260,
            shiftKey: true
        });
        firePointerEvent(window, 'pointerup', { pointerId: 63 });
        // Confirm all nodes are unselected (shift-clicked node was above range)
        expect(controller.getSnapshot()).toEqual(new Set());
    });

    it('calls onStartEditing callback when user swipes right', () => {
        // Create test component with controlled editing state that actually
        // changes when onStartEditing is called
        const onStartEditing = jest.fn();
        const TestComponent = () => {
            const [editing, setEditing] = useState(false);
            return (
                <EditableNodeList
                    editing={editing}
                    controller={createEditableNodeListController()}
                    onStartEditing={() => {
                        onStartEditing();
                        setEditing(true);
                    }}
                >
                    {DEFAULT_NODES.map((name) => (
                        <div key={name}>{name}</div>
                    ))}
                </EditableNodeList>
            );
        };
        // Render, get list element, confirm callback not called
        const { container } = render(<TestComponent />);
        const getList = () => container.querySelector('.flex.flex-col');
        expect(onStartEditing).not.toHaveBeenCalled();

        // Simulate user swiping right to enter edit mode
        fireEvent.touchStart(getList(), { touches: [{ clientX: 50, clientY: 10 }] });
        fireEvent.touchMove(getList(), { touches: [{ clientX: 1000, clientY: 10 }] });
        fireEvent.touchEnd(getList(), { changedTouches: [{ clientX: 100, clientY: 10 }] });

        // Confirm callback ran
        expect(onStartEditing).toHaveBeenCalledTimes(1);

        // Simulate user swiping right when editing is already true
        fireEvent.touchStart(getList(), { touches: [{ clientX: 50, clientY: 10 }] });
        fireEvent.touchMove(getList(), { touches: [{ clientX: 1000, clientY: 10 }] });
        fireEvent.touchEnd(getList(), { changedTouches: [{ clientX: 100, clientY: 10 }] });

        // Confirm callback did NOT run again
        expect(onStartEditing).toHaveBeenCalledTimes(1);
    });

    it('does not call onStartEditing if user swipes right while editing', () => {
        // Render component with onStartEditing callback and editing=true, get list element
        const onStartEditing = jest.fn();
        const { container } = renderTestComponent(true, DEFAULT_NODES, onStartEditing);
        const list = container.querySelector('.flex.flex-col');

        // Simulate user swiping right to enter edit mode
        fireEvent.touchStart(list, {touches: [{ clientX: 50, clientY: 10 }]});
        fireEvent.touchMove(list, {touches: [{ clientX:  1000, clientY: 10 }]});
        fireEvent.touchEnd(list, {changedTouches: [{ clientX:  100, clientY: 10 }]});

        // Confirm callback did NOT run
        expect(onStartEditing).not.toHaveBeenCalled();
    });
});

describe('EditableNodeList autoscroll', () => {
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
        const { container, controller } = renderTestComponent(true, SCROLL_NODES);
        const buttons = container.querySelectorAll('button');

        // Simulate flex parent (greater than or equal to list height)
        mockFlexParentBounds(container);

        // Simulate user starting click on first node
        elementUnderCursorIndex = 0;
        firePointerEvent(buttons[0], 'pointerdown', {
            pointerId: 1,
            button: 0,
            clientX: 240,
            clientY: 120
        });
        // Confirm first node selected immediately (before drag)
        expect(controller.getSnapshot()).toEqual(new Set(['node-1']));

        // Simulate user moving cursor into bottom autoscroll zone
        elementUnderCursorIndex = 4;
        firePointerEvent(window, 'pointermove', {
            pointerId: 1,
            clientX: 240,
            clientY: 599
        });
        // Confirm all nodes cursor passed over were selected
        expect(controller.getSnapshot()).toEqual(new Set([
            'node-1', 'node-2', 'node-3', 'node-4', 'node-5'
        ]));
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
        expect(controller.getSnapshot()).toContain('node-7');
    });

    it('scrolls overflow container when pointer enters top scroll zone', () => {
        // Render component, get list element and parent + overlay buttons
        const { container, controller } = renderTestComponent(true, SCROLL_NODES);
        const buttons = container.querySelectorAll('button');
        // Simulate fixed-height parent with overflow (less than list height)
        const { parent, _ } = mockFixedHeightParentBounds(container);

        // Simulate user starting click on 4th node
        elementUnderCursorIndex = 3;
        firePointerEvent(buttons[3], 'pointerdown', {
            pointerId: 3,
            button: 0,
            clientX: 240,
            clientY: 180
        });
        // Confirm first node selected immediately (before drag)
        expect(controller.getSnapshot()).toEqual(new Set(['node-4']));

        // Simulate user moving cursor into top autoscroll zone
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
        expect(controller.getSnapshot()).toEqual(new Set(['node-3', 'node-4']));
    });

    it('stops autoscroll when top/bottom of page reached', () => {
        // Render component, get overlay buttons
        const { container } = renderTestComponent(true, SCROLL_NODES);
        const buttons = container.querySelectorAll('button');
        // Simulate flex parent (greater than or equal to list height)
        mockFlexParentBounds(container);

        // Set page height so max scroll position is close to current scrollY
        Object.defineProperty(document.documentElement, 'scrollHeight', {
            configurable: true,
            value: window.innerHeight + 120
        });
        window.scrollY = 110;

        // Simulate user starting click, moving cursor to bottom autoscroll zone
        firePointerEvent(buttons[0], 'pointerdown', {
            pointerId: 4,
            button: 0,
            clientX: 240,
            clientY: 120
        });
        firePointerEvent(window, 'pointermove', {
            pointerId: 4,
            clientX: 240,
            clientY: 599
        });
        // Confirm requestAnimationFrame was called (start autoscroll loop)
        expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);

        // Run first animation frame (sets initial timestamp), confirm no scroll
        act(() => runAnimationFrame(1000));
        expect(window.scrollBy).not.toHaveBeenCalled();
        // Confirm autoscroll scheduled next frame
        expect(window.requestAnimationFrame).toHaveBeenCalledTimes(2);

        // Run animation frames until bottom reached
        const pageMax = document.documentElement.scrollHeight - window.innerHeight;
        let timestamp = 1016;
        for (let framesExecuted = 1; framesExecuted <= 5; framesExecuted += 1) {
            act(() => runAnimationFrame(timestamp));
            // Confirm scrolls on every frame
            expect(window.scrollBy).toHaveBeenCalledTimes(framesExecuted);
            if (window.scrollY >= pageMax) {
                break;
            }
            timestamp += 16;
        }
        // Confirm cancelAnimationFrame was called, no more frames were scheduled
        expect(global.cancelAnimationFrame).toHaveBeenCalled();
        expect(rafQueue).toHaveLength(0);
        // Confirm at bottom of page
        expect(window.scrollY).toBeGreaterThanOrEqual(pageMax);
    });

    it('stops autoscroll when top/bottom of parent div reached', () => {
        // Render component, get parent (scroll container) + overlay buttons
        const { container } = renderTestComponent(true, SCROLL_NODES);
        const buttons = container.querySelectorAll('button');
        // Simulate fixed-height parent with overflow (less than list height)
        const { parent, _ } = mockFixedHeightParentBounds(container);
        // Start closer to top (fewer scroll events)
        Object.defineProperty(parent, 'scrollTop', { configurable: true, writable: true, value: 16 });

        // Simulate user starting click, moving cursor to top autoscroll zone
        firePointerEvent(buttons[3], 'pointerdown', {
            pointerId: 9,
            button: 0,
            clientX: 240,
            clientY: 180
        });
        firePointerEvent(window, 'pointermove', {
            pointerId: 9,
            clientX: 240,
            clientY: 0
        });
        // Confirm requestAnimationFrame was called (start autoscroll loop)
        expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);

        // Run first animation frame (sets initial timestamp), confirm no scroll
        act(() => runAnimationFrame(1000));
        expect(parent.scrollTop).toBeCloseTo(16);
        // Confirm autoscroll scheduled next frame
        expect(window.requestAnimationFrame).toHaveBeenCalledTimes(2);

        // Run animation frames until top reached
        let timestamp = 1016;
        let lastScrollPosition = parent.scrollTop;
        for (let framesExecuted = 0; framesExecuted <= 5; framesExecuted += 1) {
            act(() => runAnimationFrame(timestamp));
            // Confirm scrolls on every frame
            expect(parent.scrollTop).toBeLessThan(lastScrollPosition);
            lastScrollPosition = parent.scrollTop;
            if (parent.scrollTop <= 0) {
                break;
            }
            timestamp += 16;
        }
        // Confirm cancelAnimationFrame was called, no more frames were scheduled
        expect(global.cancelAnimationFrame).toHaveBeenCalled();
        expect(rafQueue).toHaveLength(0);
        // Confirm container scrolled to top without moving the body
        expect(parent.scrollTop).toBeLessThanOrEqual(0);
        expect(window.scrollBy).not.toHaveBeenCalled();
    });

    it('stops autoscroll when cursor moves out of autoscroll zone', () => {
        // Render component, get overlay buttons
        const { container } = renderTestComponent(true, SCROLL_NODES);
        const buttons = container.querySelectorAll('button');
        // Simulate flex parent (greater than or equal to list height)
        mockFlexParentBounds(container);

        // Set page height so max scroll position is close to current scrollY
        Object.defineProperty(document.documentElement, 'scrollHeight', {
            configurable: true,
            value: window.innerHeight + 120
        });
        window.scrollY = 110;

        // Simulate user starting click, moving cursor to bottom autoscroll zone
        firePointerEvent(buttons[0], 'pointerdown', {
            pointerId: 4,
            button: 0,
            clientX: 240,
            clientY: 120
        });
        firePointerEvent(window, 'pointermove', {
            pointerId: 4,
            clientX: 240,
            clientY: 599
        });
        // Confirm requestAnimationFrame was called (start autoscroll loop)
        expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);

        // Run first animation frame (sets initial timestamp), confirm no scroll
        act(() => runAnimationFrame(1000));
        expect(window.scrollBy).not.toHaveBeenCalled();
        // Confirm autoscroll scheduled next frame
        expect(window.requestAnimationFrame).toHaveBeenCalledTimes(2);

        // Simulate user moving cursor out of the autoscroll zone
        firePointerEvent(window, 'pointermove', {
            pointerId: 4,
            clientX: 240,
            clientY: 400
        });

        // Run next frame confirm still did not scroll (no longer in zone)
        act(() => runAnimationFrame(1016));
        expect(window.scrollBy).not.toHaveBeenCalled();
        // Confirm did not schedule next frame, called cancelAnimationFrame
        expect(window.requestAnimationFrame).toHaveBeenCalledTimes(2);
        expect(global.cancelAnimationFrame).toHaveBeenCalled();
    });

    it('does not autoscroll when list is fully offscreen', () => {
        // Render component, get overlay buttons
        const { container } = renderTestComponent(true, SCROLL_NODES);
        const buttons = container.querySelectorAll('button');
        // Simulate flex parent (greater than or equal to list height)
        const { parent, list } = mockFlexParentBounds(container);

        // Simulate user starting click on first node, moving cursor off screen
        // (should start autoscroll, offscreen gets clamped to autoscroll zone)
        firePointerEvent(buttons[0], 'pointerdown', {
            pointerId: 1,
            button: 0,
            clientX: 240,
            clientY: 200
        });
        firePointerEvent(window, 'pointermove', {
            pointerId: 1,
            clientX: 240,
            clientY: 999
        });
        // Confirm requestAnimationFrame was called (start autoscroll loop)
        expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);

        // Run first animation frame (sets initial timestamp), confirm no scroll
        act(() => runAnimationFrame(1000));
        expect(window.scrollBy).not.toHaveBeenCalled();
        // Confirm autoscroll scheduled next frame
        expect(window.requestAnimationFrame).toHaveBeenCalledTimes(2);

        // Simulate list going completely off screen in next frame
        parent.getBoundingClientRect = jest.fn(() => ({
            top: 900,
            bottom: 1500,
            left: 190,
            right: 610,
            width: 420,
            height: 600
        }));
        list.getBoundingClientRect = jest.fn(() => ({
            top: 900,
            bottom: 1500,
            left: 200,
            right: 600,
            width: 400,
            height: 600
        }));

        // Run next animation frame
        act(() => runAnimationFrame(1032));
        // Confirm scrolled once, scheduled next frame, then cancelled when
        // getIndexFromPoint saw that list went off screen
        expect(window.scrollBy).toHaveBeenCalledTimes(1);
        expect(window.requestAnimationFrame).toHaveBeenCalledTimes(3);
        expect(global.cancelAnimationFrame).toHaveBeenCalled();

        // Simulate user moving cursor further off screen
        // (still in autoscroll zone due to clamp)
        firePointerEvent(window, 'pointermove', {
            pointerId: 1,
            clientX: 240,
            clientY: 1099
        });

        // Confirm handlePointerMove did NOT schedule autoscroll
        expect(window.requestAnimationFrame).toHaveBeenCalledTimes(3);
    });

    it('does not autoscroll when user right clicks and drags', () => {
        // Render component, get overlay buttons
        const { container } = renderTestComponent(true, SCROLL_NODES);
        const buttons = container.querySelectorAll('button');
        // Simulate flex parent (greater than or equal to list height)
        mockFlexParentBounds(container);

        // Simulate user right clicking and dragging to bottom autoscroll zone
        firePointerEvent(buttons[0], 'pointerdown', {
            pointerId: 1,
            button: 2,
            clientX: 240,
            clientY: 120
        });
        firePointerEvent(window, 'pointermove', {
            pointerId: 1,
            clientX: 240,
            clientY: 599
        });

        // Confirm requestAnimationFrame was NOT called
        expect(window.requestAnimationFrame).not.toHaveBeenCalled();
    });
});
