import React, { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';
import controllerPropTypes from 'src/types/editableNodeListControllerPropTypes';

// Takes controller passed to EditableNodeList, returns array of selected item keys
export const getSelectedItems = (controller) => {
    if (!controller) return [];
    return Array.from(controller.getSnapshot());
};

// Takes array of selected item keys, object with details of each item (keys
// match selectedItems), and object with one or more required attribute values.
//
// Filters selectedItems to the items with all required attributes and returns.
export const filterSelectedItems = (selectedItems, itemDetails, requiredAttributes) => {
    return selectedItems.filter(key => {
        // Key is not in itemDetails
        if (!itemDetails[key]) return false;
        // Check if all required attributes have correct values
        return Object.entries(requiredAttributes).every(([attribute, value]) =>
            itemDetails[key][attribute] === value
        );
    });
};

// Takes element, returns getBoundingClientRect clamped to viewport (the
// rect around the visible portion of the element, excluding offscreen)
const getVisibleRect = (element) => {
    if (!element) return null;

    const rect = element.getBoundingClientRect();
    const top = Math.max(rect.top, 0);
    const bottom = Math.min(rect.bottom, window.innerHeight);
    const left = Math.max(rect.left, 0);
    const right = Math.min(rect.right, window.innerWidth);

    // Return null if entirely offscreen
    if (bottom <= top || right <= left) return null;

    return { top, bottom, left, right, height: bottom - top, width: right - left };
};

// Takes cursor coordinates, returns clamped to viewport dimensions
const getClampedPosition = (cursorX, cursorY) => ({
    x: Math.min(Math.max(cursorX, 0), window.innerWidth - 1),
    y: Math.min(Math.max(cursorY, 0), window.innerHeight - 1)
});

// Takes editing (bool), controller object, and children (list of nodes).
// Renders each node with a wrapper with a hidden checkbox for each node.
// When editing is true nodes shrink to show hidden checkbox, clicking checkbox
// or transparent overlay over node toggles selection in controller.
const EditableNodeList = ({ editing, controller, children }) => {
    const listRef = useRef(null);
    const dragStateRef = useRef(null);
    const pointerHandlersRef = useRef({ move: null, up: null, cancel: null });
    const autoScrollRef = useRef({ frameId: null, direction: 0, speed: 0 });
    const lastPointerPositionRef = useRef(null);

    const nodes = useMemo(() => React.Children.toArray(children), [children]);

    // Get array of node keys (remove .$ prefix added by react)
    const itemKeys = useMemo(() => nodes.map(
        (node) => String(node.key).slice(2)
    ), [nodes]);

    // Subscribe to controller (returns Set with selected item keys)
    const selected = useSyncExternalStore(
        controller.subscribe,
        controller.getSnapshot
    );

    // Takes dragStateRef.current and index of node cursor is currently over
    // Selects/unselects all nodes between node where drag started and current
    const applyRangeSelection = (state, currentIndex) => {
        // Get range from index where drag started to current index
        const rangeMin = Math.min(state.initialIndex, currentIndex);
        const rangeMax = Math.max(state.initialIndex, currentIndex);

        // Skip if range is same as last call, otherwise update for next call
        if (state.activeRange.min === rangeMin && state.activeRange.max === rangeMax) {
            return;
        }
        state.activeRange = { min: rangeMin, max: rangeMax };

        const nextSelection = new Set(state.originalSelection);
        if (state.mode === 'select') {
            // Selecting: add all items in range to selection
            for (let i = rangeMin; i <= rangeMax; i += 1) {
                nextSelection.add(itemKeys[i]);
            }
        } else {
            // Unselecting: remove all items in range from selection
            for (let i = rangeMin; i <= rangeMax; i += 1) {
                nextSelection.delete(itemKeys[i]);
            }
        }

        controller.replace(nextSelection);
    };

    // Takes cursor coordinates, returns index of node under cursor (or null)
    const getIndexFromPoint = (clientX, clientY) => {
        // Get all elements under cursor, find node wrapper by data attribute
        const elements = document.elementsFromPoint?.(clientX, clientY) || [];
        const rowElement = elements.find((el) =>
            el?.hasAttribute?.('data-editable-index') && listRef?.current?.contains(el)
        );
        // Return index from data attribute
        if (rowElement) {
            return Number(rowElement.getAttribute('data-editable-index'));
        }
        return null;
    };

    // Cancels running autoscroll loop and clears refs
    const stopAutoScroll = () => {
        if (autoScrollRef.current.frameId) {
            cancelAnimationFrame(autoScrollRef.current.frameId);
        }
        autoScrollRef.current.frameId = 0;
        autoScrollRef.current.lastTimestamp = 0;
        autoScrollRef.current.v = 0;
    };

    // Takes timestamp from requestAnimationFrame, updates scroll position
    // Scrolls up if cursor is in top scroll zone, down if in bottom scroll zone
    // Runs on every frame until top/bottom reached or cursor no longer in zone
    const handleAutoScrollFrame = (timestamp) => {
        // Don't scroll if drag ended or speed is zero
        if (!dragStateRef.current || autoScrollRef.current.speed === 0) {
            stopAutoScroll();
            return;
        }

        // Step size: Multiply speed (px/second) by seconds since last frame
        // Maintains scroll speed when frames are missed
        const lastTimestamp = autoScrollRef.current.lastTimestamp || timestamp;
        const secondsSinceLast = (timestamp - lastTimestamp) / 1000;
        const stepSize = autoScrollRef.current.speed * secondsSinceLast;

        // Step size will be zero on first loop (0 seconds since last frame)
        if (stepSize !== 0) {
            const parent = listRef.current.parentElement;

            // Fixed-height parent with overflow-y: auto, scroll parent
            if (listRef.current.clientHeight > parent.clientHeight) {
                parent.scrollTop += stepSize;

                // Break loop if top/bottom reached (pointermove will restart)
                const parentTop = parent.scrollTop;
                const parentMax = parent.scrollHeight - parent.clientHeight;
                if (parentTop <= 0 || parentTop >= parentMax) {
                    stopAutoScroll();
                    return;
                }

            // Flex column parent, scroll whole page
            } else {
                window.scrollBy(0, stepSize);

                // Break loop if top/bottom reached (pointermove will restart)
                const pageTop = window.scrollY;
                const pageMax = document.documentElement.scrollHeight - window.innerHeight;
                if (pageTop <= 0 || pageTop >= pageMax) {
                    stopAutoScroll();
                    return;
                }
            }

            // Check which node is under cursor after scroll, update selection
            const pointerPosition = lastPointerPositionRef.current;
            if (pointerPosition) {
                const index = getIndexFromPoint(pointerPosition.x, pointerPosition.y);
                if (index !== null && index !== dragStateRef.current.lastEventIndex) {
                    applyRangeSelection(dragStateRef.current, index);
                }
            }
        }

        // Repeat on next frame
        autoScrollRef.current.lastTimestamp = timestamp;
        autoScrollRef.current.frameId = requestAnimationFrame(handleAutoScrollFrame);
    };

    // Takes cursor Y coordinate, returns scroll speed in px/second
    // 0 = no scroll, negative = scroll up, positive = scroll down
    // Max scroll speed is full viewport height every second
    // Optional zone arg controls height of scroll zones
    const getAutoScrollSpeed = (clientY, zone = 80) => {
        // Get rect around visible portion of list to detect if cursor is near
        // top/bottom (cursor can't reach actual top/bottom if offscreen)
        const visibleRect = getVisibleRect(listRef.current);
        // Don't scroll if whole list off screen
        if (!visibleRect) return;

        // Positions where scroll starts (slow, faster further past boundary)
        const scrollUpBoundary = visibleRect.top + zone;
        const scrollDownBoundary = visibleRect.bottom - zone;

        // Scroll up if cursor above scrollUpBoundary
        if (clientY < scrollUpBoundary) {
            // Get distance into zone as ratio (0=at boundary, 1=top of zone)
            const ratio = Math.min(zone, scrollUpBoundary - clientY) / zone;
            // Multiply by screen height to get px/second (negative = scroll up)
            return -(ratio * window.innerHeight);
        }
        // Scroll down if cursor below scrollDownBoundary
        if (clientY > scrollDownBoundary) {
            // Get distance into zone as ratio (0=at boundary, 1=bottom of zone)
            const ratio = Math.min(zone, clientY - scrollDownBoundary) / zone;
            // Multiply by screen height to get px/second
            return ratio * window.innerHeight;
        }
        // Don't scroll if cursor not in either zone
        return 0;
    };

    // Remove all pointer listeners set by beginDrag and clear state refs.
    // Runs on click end, cancel, when editing toggles off, and on unmount.
    const finishDrag = () => {
        window.removeEventListener('pointermove', pointerHandlersRef.current.move);
        window.removeEventListener('pointerup', pointerHandlersRef.current.up);
        window.removeEventListener('pointercancel', pointerHandlersRef.current.cancel);
        pointerHandlersRef.current = { move: null, up: null, cancel: null };
        lastPointerPositionRef.current = null;
        dragStateRef.current = null;
        stopAutoScroll();
    };

    // Toggle clicked node selection immediately, add pointer listeners that
    // select/unselect all nodes mouse drags over + remove listeners on drag end
    const beginDrag = (event, index) => {
        // Ignore if another drag already active (multitouch)
        if (dragStateRef.current) return;
        // Ignore if no items or not editing
        if (!editing || itemKeys.length === 0) return;
        // Ignore right click drag (must be left click)
        if (event.button !== undefined && event.button !== 0) return;

        // Get key of node where drag started + selection when drag started
        const key = itemKeys[index];
        const originalSelection = new Set(controller.getSnapshot());
        // Selecting if user clicked unselected node, otherwise unselecting
        const mode = originalSelection.has(key) ? 'unselect' : 'select';

        // Toggle clicked node selected state immediately (before drag)
        controller.toggle(key);

        // Store state in dragStateRef (used by other handlers)
        const state = {
            pointerId: event.pointerId,
            initialIndex: index,
            mode,
            originalSelection,
            activeRange: { min: index, max: index},
            lastEventIndex: index,
        };
        dragStateRef.current = state;

        // Store pointer position (used for autoscroll)
        lastPointerPositionRef.current = getClampedPosition(
            event.clientX,
            event.clientY
        );

        const handlePointerMove = (moveEvent) => {
            // Ignore pointers that did not start drag (multitouch)
            if (moveEvent.pointerId !== dragStateRef.current.pointerId) return;

            // Update last pointer position (used for autoscroll)
            lastPointerPositionRef.current = getClampedPosition(
                moveEvent.clientX,
                moveEvent.clientY
            );

            // Get index of node under pointer (null if not over a node)
            const newIndex = getIndexFromPoint(moveEvent.clientX, moveEvent.clientY);
            // Update selection if pointer over different node than last event
            if (newIndex !== null && newIndex !== state.lastEventIndex) {
                state.lastEventIndex = newIndex;
                applyRangeSelection(state, newIndex);
            }

            // Calculate autoscroll speed (0 if pointer not in top/bottom zones)
            autoScrollRef.current.speed = getAutoScrollSpeed(moveEvent.clientY);
            // Start autoscroll loop if speed not zero and not already running
            if (autoScrollRef.current.speed && !autoScrollRef.current.frameId) {
                autoScrollRef.current.frameId = requestAnimationFrame(
                    handleAutoScrollFrame
                );
            }
        };

        // Ends drag event when click/touch released
        const handlePointerEnd = (endEvent) => {
            // Ignore pointers that did not start drag (multitouch)
            if (endEvent.pointerId !== state.pointerId) return;
            finishDrag();
        };

        // Store handlers so finishDrag can remove them when click released
        pointerHandlersRef.current = {
            move: handlePointerMove,
            up: handlePointerEnd,
            cancel: handlePointerEnd,
        };

        // Update selection when pointer moves
        window.addEventListener('pointermove', handlePointerMove);
        // End drag (remove listeners) when touch/click released
        window.addEventListener('pointerup', handlePointerEnd);
        // Abort drag if pointercancel fires (eg opened iOS control center)
        // Prevents getting stuck in drag (can't start another until first ends)
        window.addEventListener('pointercancel', handlePointerEnd);
    };

    // Remove listeners when component unmounts
    useEffect(() => finishDrag, []);

    // Remove listeners when editing toggles off
    useEffect(() => {
        if (!editing) {
            finishDrag();
        }
    }, [editing]);

    return (
        <div ref={listRef} className="flex flex-col gap-4">
            {nodes.map((node, index) => {
                // Get node key, check if selected (checkbox state)
                const key = itemKeys[index];
                const isSelected = selected.has(key);

                return (
                    <div
                        key={key}
                        className="flex relative"
                        data-editable-index={index}
                        data-editable-key={key}
                    >
                        <div className="absolute flex h-full z-0">
                            <input
                                type="checkbox"
                                tabIndex={editing ? 0 : -1}
                                checked={isSelected}
                                onChange={() => controller.toggle(key)}
                                className="radio my-auto"
                                aria-label={`Select ${node.props?.name || 'node'}`}
                            />
                        </div>
                        <div className={clsx(
                            'w-full overflow-hidden transition-all duration-300',
                            editing ? 'ml-[2.5rem]' : 'ml-0'
                        )}>
                            {node}
                        </div>
                        <button
                            type="button"
                            tabIndex={-1}
                            // Cover full node when editing (click to select)
                            // Disable touch actions to prevent scrolling page
                            // (allows dragging to select multiple on mobile)
                            className={clsx(
                                'cursor-pointer absolute z-20',
                                editing && 'size-full touch-none select-none'
                            )}
                            onPointerDown={(event) => beginDrag(event, index)}
                            aria-hidden="true"
                        />
                    </div>
                );
            })}
        </div>
    );
};

EditableNodeList.propTypes = {
    editing: PropTypes.bool.isRequired,
    controller: controllerPropTypes.isRequired,
    children: PropTypes.node
};

export default EditableNodeList;
