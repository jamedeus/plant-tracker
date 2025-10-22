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

// Takes editing (bool), controller object, and children (list of nodes).
// Renders each node with a wrapper with a hidden checkbox for each node.
// When editing is true nodes shrink to show hidden checkbox, clicking checkbox
// or transparent overlay over node toggles selection in controller.
const EditableNodeList = ({ editing, controller, children }) => {
    const listRef = useRef(null);
    const dragStateRef = useRef(null);
    const pointerHandlersRef = useRef({ move: null, up: null, cancel: null });

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

    // Remove all pointer listeners set by beginDrag and clear state refs.
    // Runs on click end, cancel, when editing toggles off, and on unmount.
    const finishDrag = () => {
        window.removeEventListener('pointermove', pointerHandlersRef.current.move);
        window.removeEventListener('pointerup', pointerHandlersRef.current.up);
        window.removeEventListener('pointercancel', pointerHandlersRef.current.cancel);
        pointerHandlersRef.current = { move: null, up: null, cancel: null };
        dragStateRef.current = null;
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

        const handlePointerMove = (moveEvent) => {
            // Ignore pointers that did not start drag (multitouch)
            if (moveEvent.pointerId !== dragStateRef.current.pointerId) return;

            // Get index of node under pointer (null if not over a node)
            const newIndex = getIndexFromPoint(moveEvent.clientX, moveEvent.clientY);
            // Update selection if pointer over different node than last event
            if (newIndex !== null && newIndex !== state.lastEventIndex) {
                state.lastEventIndex = newIndex;
                applyRangeSelection(state, newIndex);
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
