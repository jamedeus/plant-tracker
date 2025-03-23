import React from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';

// Takes editing (bool), formRef (used to parse FormData), and node list
// Returns node list wrapped in form with a hidden checkbox for each node
// When editing is true nodes shrink to show hidden checkbox
const EditableNodeList = ({ editing, formRef, children }) => {
    return (
        <form ref={formRef}>
            {children.map((node) => (
                <div key={node.key} className="flex relative mb-4">
                    <div className="absolute flex h-full z-0">
                        <input
                            type="checkbox"
                            id={`select-${node.key}`}
                            name={node.key}
                            className="radio checked:bg-blue-500 my-auto"
                        />
                    </div>
                    <div className={clsx(
                        'w-full overflow-hidden transition-all duration-300',
                        editing ? 'ml-[2.5rem]' : 'ml-0'
                    )}>
                        {node}
                    </div>
                    <label
                        htmlFor={`select-${node.key}`}
                        className={clsx(
                            "cursor-pointer absolute z-20",
                            editing && "h-full w-full"
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
