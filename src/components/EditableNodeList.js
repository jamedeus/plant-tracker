import React, { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';
import controllerPropTypes from 'src/types/editableNodeListControllerPropTypes';

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

// Takes element, returns DOMRect around visible portion of the element
// Clamps to parent rect (if parent is fixed height with overflow child may be
// bigger) and viewport (if page has overflow element may be bigger than screen)
const getVisibleRect = (element) => {
    /* istanbul ignore next: shouldn't be reachable unless runs after unmount */
    if (!element) return null;

    const rect = element.getBoundingClientRect();
    const parentRect = element.parentElement.getBoundingClientRect();
    const top = Math.max(rect.top, parentRect.top, 0);
    const bottom = Math.min(rect.bottom, parentRect.bottom, window.innerHeight);
    const left = Math.max(rect.left, parentRect.left, 0);
    const right = Math.min(rect.right, parentRect.right, window.innerWidth);

    // Return null if entirely offscreen
    if (bottom <= top || right <= left) return null;

    return { top, bottom, left, right, height: bottom - top, width: right - left };
};

// Takes cursor Y coordinate, returns clamped to viewport height
const getClampedY = (y) => Math.min(Math.max(y, 0), window.innerHeight - 1);

// Takes editing (bool), controller object, and children (list of nodes).
// Renders each node in a wrapper with a hidden checkbox that shows if selected.
// When editing is true nodes shrink to show hidden checkbox, clicking anywhere
// on node or checkbox toggles selection in controller.
//
// Clicking and dragging selects all nodes the cursor passes over and scrolls
// page when cursor nears top/bottom. Optional scrollZoneHeight prop configures
// scroll zone height (px) and the optional offset props adjust boundaries where
// scroll zones begin (positive moves toward middle, negative moves outward).
const EditableNodeList = ({
    editing,
    controller,
    children,
    scrollZoneHeight=112,
    scrollZoneOffsetTop=0,
    scrollZoneOffsetBottom=0
}) => {
    // Wrapper div containing list of nodes
    const listRef = useRef(null);
    // Stores state for current drag gesture (null if not dragging)
    const dragStateRef = useRef(null);
    // Stores event handlers for current drag gesture (used for cleanup)
    const pointerHandlersRef = useRef({ move: null, up: null, cancel: null });
    // Stores autoscroll state for current drag gesture
    const autoScrollRef = useRef({
        speed: 0,
        frameId: null,
        lastTimestamp: 0,
        lastCursorY: null
    });
    // Stores state passed to applyRangeSelection when user shift-clicks
    const shiftClickRef = useRef({
        initialIndex: null,
        mode: null,
        originalSelection: null
    });

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

    // Takes cursor Y coordinate, returns index of node at same height (or null)
    const getIndexFromPoint = (clientY) => {
        // If list is entirely off screen return null and stop autoscroll
        const visibleRect = getVisibleRect(listRef.current);
        if (!visibleRect) {
            stopAutoScroll();
            return null;
        }
        // Get center of list (x axis)
        const center = visibleRect.width / 2 + visibleRect.left;

        // Clamp Y coordinate to last clickable px at top/bottom of list
        // Fixes not selecting during autoscroll if cursor is above/below list
        const clampedY = Math.max(
            visibleRect.top + 1,
            Math.min(clientY, visibleRect.bottom - 1)
        );

        // Get all elements with same Y coordinate as cursor
        const elements = document.elementsFromPoint(center, clampedY);
        // Find node wrapper, return index from data attribute
        const nodeWrapper = elements.find((el) =>
            el?.hasAttribute?.('data-editable-index') && listRef?.current?.contains(el)
        );
        if (nodeWrapper) {
            return Number(nodeWrapper.getAttribute('data-editable-index'));
        }
        return null;
    };

    // Cancels running autoscroll loop and clears refs
    const stopAutoScroll = () => {
        if (autoScrollRef.current.frameId) {
            cancelAnimationFrame(autoScrollRef.current.frameId);
        }
        autoScrollRef.current.speed = 0;
        autoScrollRef.current.frameId = null;
        autoScrollRef.current.lastTimestamp = 0;
        autoScrollRef.current.lastCursorY = null;
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

        // Schedule to run again on next frame
        autoScrollRef.current.lastTimestamp = timestamp;
        autoScrollRef.current.frameId = requestAnimationFrame(handleAutoScrollFrame);

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
            const index = getIndexFromPoint(autoScrollRef.current.lastCursorY);
            if (index !== null && index !== dragStateRef.current.lastEventIndex) {
                dragStateRef.current.lastEventIndex = index;
                applyRangeSelection(dragStateRef.current, index);
            }
        }
    };

    // Takes cursor Y coordinate, returns scroll speed in px/second
    // 0 = no scroll, negative = scroll up, positive = scroll down
    // Max scroll speed is full viewport height every second
    const getAutoScrollSpeed = (clientY) => {
        // Get rect around visible portion of list to detect if cursor is near
        // top/bottom (cursor can't reach actual top/bottom if offscreen)
        const visibleRect = getVisibleRect(listRef.current);
        // Don't scroll if whole list off screen
        if (!visibleRect) return 0;

        // Positions where scroll starts (slow, faster further past boundary)
        const scrollUpBoundary = visibleRect.top + scrollZoneHeight + scrollZoneOffsetTop;
        // Subtract 1 so it can actually hit max speed going down
        const scrollDownBoundary = visibleRect.bottom - scrollZoneHeight - scrollZoneOffsetBottom - 1;

        // Scroll up if cursor above scrollUpBoundary
        if (clientY < scrollUpBoundary) {
            // Get distance into zone as ratio (0=at boundary, 1=top of zone)
            const ratio = Math.min(scrollZoneHeight, scrollUpBoundary - clientY) / scrollZoneHeight;
            // Multiply by screen height to get px/second (negative = scroll up)
            return -(ratio * window.innerHeight);
        }
        // Scroll down if cursor below scrollDownBoundary
        if (clientY > scrollDownBoundary) {
            // Get distance into zone as ratio (0=at boundary, 1=bottom of zone)
            const ratio = Math.min(scrollZoneHeight, clientY - scrollDownBoundary) / scrollZoneHeight;
            // Multiply by screen height to get px/second
            return ratio * window.innerHeight;
        }
        // Don't scroll if cursor not in either zone
        return 0;
    };

    // Remove all pointer listeners set by beginDrag and clear state refs.
    // Runs on click end, cancel, when editing toggles off, and on unmount.
    const finishDrag = () => {
        // Save last index, mode, and selection in case user shift-clicks
        if (dragStateRef.current) {
            shiftClickRef.current = {
                initialIndex: dragStateRef.current.lastEventIndex,
                mode: dragStateRef.current.mode,
                originalSelection: new Set(controller.getSnapshot())
            };
        }

        window.removeEventListener('pointermove', pointerHandlersRef.current.move);
        window.removeEventListener('pointerup', pointerHandlersRef.current.up);
        window.removeEventListener('pointercancel', pointerHandlersRef.current.cancel);
        pointerHandlersRef.current = { move: null, up: null, cancel: null };
        dragStateRef.current = null;
        stopAutoScroll();
    };

    // Toggle clicked node selection immediately, add pointer listeners that
    // select/unselect all nodes mouse drags over + remove listeners on drag end
    const beginDrag = (event, index) => {
        // Ignore if another drag already active (multitouch)
        if (dragStateRef.current) return;
        // Ignore right click drag (must be left click)
        if (event.button !== undefined && event.button !== 0) return;

        // Shift click: update selection and exit without starting drag (unless
        // this is the first click, shift-click needs 2 points to select range)
        if (
            event.shiftKey &&
            shiftClickRef.current.initialIndex !== null &&
            shiftClickRef.current.originalSelection
        ) {
            applyRangeSelection(shiftClickRef.current, index);
            return;
        }

        // Get key of node where drag started + selection when drag started
        const key = itemKeys[index];
        const originalSelection = new Set(controller.getSnapshot());
        // Selecting if user clicked unselected node, otherwise unselecting
        const mode = originalSelection.has(key) ? 'unselect' : 'select';

        // Toggle clicked node selected state immediately (before drag)
        controller.toggle(key);

        // Save last index, mode, and selection in case user shift-clicks after
        // dragging (add/subtract to range selected during drag)
        shiftClickRef.current = {
            initialIndex: index,
            mode,
            originalSelection
        };

        // Store state in dragStateRef (used by other handlers)
        const state = {
            pointerId: event.pointerId,
            initialIndex: index,
            mode,
            originalSelection,
            lastEventIndex: index,
        };
        dragStateRef.current = state;

        // Store pointer position (used for autoscroll)
        autoScrollRef.current.lastCursorY = getClampedY(event.clientY);

        const handlePointerMove = (moveEvent) => {
            // Ignore pointers that did not start drag (multitouch)
            if (moveEvent.pointerId !== dragStateRef.current.pointerId) return;

            // Get index of node under pointer (null if not over a node)
            const newIndex = getIndexFromPoint(moveEvent.clientY);
            // Update selection if pointer over different node than last event
            if (newIndex !== null && newIndex !== state.lastEventIndex) {
                state.lastEventIndex = newIndex;
                applyRangeSelection(state, newIndex);
            }

            // Update last pointer position for autoscroll
            autoScrollRef.current.lastCursorY = getClampedY(moveEvent.clientY);
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

    // Handle EditableNodeList children changing (deleted, filtered, etc)
    useEffect(() => {
        // Unselect items that are no longer in list
        const next = new Set(controller.getSnapshot());
        next.forEach(key => !itemKeys.includes(key) && next.delete(key));
        controller.replace(next);
        // Reset shift-click state (anchor index probably moved)
        shiftClickRef.current = {
            initialIndex: null,
            mode: null,
            originalSelection: null
        };
    }, [itemKeys]);

    // Remove listeners when component unmounts
    useEffect(() => finishDrag, []);

    // Remove listeners when editing toggles off
    useEffect(() => {
        if (!editing) {
            finishDrag();
        }
    }, [editing]);

    // Toggles selection when user presses enter or space while item focused
    const handleKeyDown = (event, key) => {
        if (event.key === 'Enter' || event.key === ' ') {
            controller.toggle(key);
        }
    };

    return (
        <div
            ref={listRef}
            className={clsx("flex flex-col gap-4", editing && "select-none")}
        >
            {nodes.map((node, index) => {
                const key = itemKeys[index];
                const isSelected = selected.has(key);
                const name = node.props?.name || 'node';
                const label = `${isSelected ? 'Unselect' : 'Select'} ${name}`;

                return (
                    <div key={key} className="flex relative">
                        {/* Selection indicator (div with radio button css) */}
                        <div className={clsx(
                            "radio absolute top-1/2 -translate-y-1/2 z-0",
                            isSelected && "radio-checked"
                        )} />
                        <div className={clsx(
                            'w-full overflow-hidden transition-all duration-300',
                            editing ? 'ml-[2.5rem]' : 'ml-0'
                        )}>
                            {node}
                        </div>
                        {/* Transparent overlay covers item when editing */}
                        {editing && (
                            <button
                                type="button"
                                // Cover full node (click anywhere to select)
                                // No touch actions to prevent scrolling page
                                // (allows dragging to select on mobile)
                                className={clsx(
                                    'absolute -inset-2 z-20 outline-accent',
                                    'focus-visible:rounded-[1.25rem]',
                                    'focus-visible:outline-2 -outline-offset-1',
                                    'cursor-pointer touch-none select-none'
                                )}
                                onPointerDown={event => beginDrag(event, index)}
                                onKeyDown={event => handleKeyDown(event, key)}
                                aria-label={label}
                                data-editable-index={index}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
};

EditableNodeList.propTypes = {
    editing: PropTypes.bool.isRequired,
    controller: controllerPropTypes.isRequired,
    children: PropTypes.node,
    scrollZoneHeight: PropTypes.number,
    scrollZoneOffsetTop: PropTypes.number,
    scrollZoneOffsetBottom: PropTypes.number
};

export default EditableNodeList;
