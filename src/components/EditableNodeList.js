import React from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';

// Takes editing (bool), selected (ref containing array), and node list
// Returns node list with wrapper div around each node
// When editing is true wrapper renders checkbox next to each node
// Checkboxes add/remove node's key to/from selected array when clicked
const EditableNodeList = ({ editing, selected, children }) => {
    // Checkbox handler adds key to selected if not present, removes if present
    const selectNode = (key) => {
        if (selected.current.includes(key)) {
            selected.current = selected.current.filter(item => item !== key);
        } else {
            selected.current.push(key);
        }
    };

    return (
        <>
            {children.map((node) => (
                <div key={node.key} className="flex relative mb-4">
                    <label className="label cursor-pointer absolute flex h-full">
                        <input
                            type="checkbox"
                            className="radio checked:bg-blue-500 my-auto"
                            defaultChecked={selected.current.includes(node.key)}
                            onChange={() => selectNode(node.key)}
                        />
                    </label>
                    <div className={clsx(
                        'w-full overflow-hidden transition-all duration-300',
                        editing ? 'ml-[2.5rem]' : 'ml-0'
                    )}>
                        {node}
                    </div>
                </div>
            ))}
        </>
    );
};

EditableNodeList.propTypes = {
    editing: PropTypes.bool.isRequired,
    selected: PropTypes.shape({
        current: PropTypes.array
    }).isRequired,
    children: PropTypes.node
};

export default EditableNodeList;
