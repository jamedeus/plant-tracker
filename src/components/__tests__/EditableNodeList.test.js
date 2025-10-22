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
        // Confirm first note selected immediately (before drag)
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
        // Confirm first note unselected immediately (before drag)
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
        // Confirm first note selected immediately (before drag)
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
        // Render component with editing = false, get overlay buttons
        const { container, controller } = renderTestComponent(false);
        const buttons = container.querySelectorAll('button');

        // Confirm nothing is selected
        expect(getSelectedItems(controller)).toEqual([]);

        // Simulate user starting click on first node, dragging to third node
        elementUnderCursorIndex = 0;
        firePointerEvent(buttons[0], 'pointerdown', {
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
