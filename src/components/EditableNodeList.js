import React, { useState, useEffect, useRef } from 'react';

// Takes editing (state bool), selected (ref containing array), and node list
// Returns node list with wrapper div around each node
// When editing is true wrapper renders checkbox next to each node
// Checkboxes add/remove node's key to/from selected array when clicked
const EditableNodeList = ({ editing, selected, children }) => {
    // Add node's key to selected if not already present, remove if present
    const selectNode = (key) => {
        const oldSelected = [...selected.current];
        if (oldSelected.includes(key)) {
            oldSelected.splice(oldSelected.indexOf(key), 1);
        } else {
            oldSelected.push(key);
        }
        selected.current = oldSelected;
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
                                onClick={() => selectNode(node.key)}
                            />
                        </label>
                        <div className="ml-2 w-full">
                            {node}
                        </div>
                    </div>
                )
            case(false):
                return (
                    <div className="mb-4">
                        {node}
                    </div>
                )
        }
    };

    return (
        <>
            {children.map((node) => {
                return <NodeWrapper key={node.key} node={node} editing={editing} />
            })}
        </>
    );
}

export default EditableNodeList;
