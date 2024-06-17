import React from 'react';
import PropTypes from 'prop-types';

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

    // Takes node and editing state bool, returns node in bottom-padded div
    // Wrapper adds checkbox next to node if editing bool is true
    const NodeWrapper = ({ node, editing }) => {
        switch(editing) {
            case(true):
                return (
                    <div className="flex mb-4">
                        <label className="label cursor-pointer">
                            <input
                                type="checkbox"
                                className="radio checked:bg-blue-500"
                                defaultChecked={selected.current.includes(node.key)}
                                onChange={() => selectNode(node.key)}
                            />
                        </label>
                        <div className="ml-2 w-full overflow-hidden">
                            {node}
                        </div>
                    </div>
                );
            case(false):
                return (
                    <div className="mb-4">
                        {node}
                    </div>
                );
        }
    };

    NodeWrapper.propTypes = {
        node: PropTypes.node,
        editing: PropTypes.bool
    };

    return (
        <>
            {children.map((node) => {
                // eslint-disable-next-line react/prop-types
                return <NodeWrapper key={node.key} node={node} editing={editing} />;
            })}
        </>
    );
};

EditableNodeList.propTypes = {
    editing: PropTypes.bool,
    selected: PropTypes.shape({
        current: PropTypes.array
    }).isRequired,
    children: PropTypes.node
};

export default EditableNodeList;
