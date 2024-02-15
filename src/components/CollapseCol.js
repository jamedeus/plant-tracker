import React, { useState, useEffect, useRef } from 'react';

// Renders DaisyUI collapse with centered title and vertical column of nodes
const CollapseCol = ({ title, children, defaultOpen=true }) => {
    // Track collapse open state
    const [open, setOpen] = useState(defaultOpen);

    const toggle = () => {
        setOpen(!open);
    };

    return (
        <div className="collapse bg-base-200 w-96 px-4 mx-auto max-w-90 md:max-w-full">
            <input type="checkbox" onChange={toggle} defaultChecked={open} />
            <div className="collapse-title text-xl font-medium text-center">
                {title}
            </div>
            <div className="collapse-content">
                {children}
            </div>
        </div>
    );
}

export default CollapseCol;
