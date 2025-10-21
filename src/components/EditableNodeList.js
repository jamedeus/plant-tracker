import React, { useId, useSyncExternalStore } from 'react';
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
    const prefix = useId();
    const nodes = React.Children.toArray(children);

    // Subscribe to controller (returns Set with selected item keys)
    const selected = useSyncExternalStore(
        controller.subscribe,
        controller.getSnapshot
    );

    return (
        <div className="flex flex-col gap-4">
            {nodes.map((node) => {
                // Remove .$ prefix added to keys by React
                const key = String(node.key).replace(/^\.\$/, '');
                const checkboxId = `${prefix}-${key}`;
                const isSelected = selected.has(key);

                return (
                    <div key={key} className="flex relative">
                        <div className="absolute flex h-full z-0">
                            <input
                                type="checkbox"
                                tabIndex={editing ? 0 : -1}
                                id={checkboxId}
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
                        <label
                            htmlFor={checkboxId}
                            className={clsx(
                                'cursor-pointer absolute z-20',
                                editing && 'size-full'
                            )}
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
