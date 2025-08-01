import React, { useId } from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';

// Takes formRef passed to EditableNodeList, returns array of selected item keys
export const getSelectedItems = (formRef) => {
    if (formRef.current) {
        const selected = new FormData(formRef.current);
        return Array.from(selected.keys());
    } else {
        return [];
    }
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

// Takes editing (bool), formRef (used to parse FormData), and node list
// Returns node list wrapped in form with a hidden checkbox for each node
// When editing is true nodes shrink to show hidden checkbox
const EditableNodeList = ({ editing, formRef, children }) => {
    // Get unique checkbox ID prefix (allows multiple EditableNodelist with
    // overlapping contents on same page)
    const prefix = useId();

    return (
        <form ref={formRef} className="flex flex-col gap-4">
            {children.map((node) => (
                <div key={node.key} className="flex relative">
                    <div className="absolute flex h-full z-0">
                        <input
                            type="checkbox"
                            tabIndex={editing ? 0 : -1}
                            id={`${prefix}-${node.key}`}
                            name={node.key}
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
                        htmlFor={`${prefix}-${node.key}`}
                        className={clsx(
                            "cursor-pointer absolute z-20",
                            editing && "size-full"
                        )}
                    />
                </div>
            ))}
        </form>
    );
};

EditableNodeList.propTypes = {
    editing: PropTypes.bool.isRequired,
    formRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    ]).isRequired,
    children: PropTypes.node
};

export default EditableNodeList;
