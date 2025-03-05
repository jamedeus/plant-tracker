import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

// Renders DaisyUI collapse with centered title and vertical column of nodes
const CollapseCol = ({ title, children, scroll=false }) => {
    // Track collapse open state
    const [open, setOpen] = useState(true);

    const toggle = () => {
        setOpen(!open);
    };

    const scrollRef = useRef(null);

    // Scroll contents into view when opened if scroll is true
    useEffect(() => {
        if (scroll && open) {
            // Wait for open animation to complete (for iOS)
            setTimeout(() => {
                if (scrollRef.current) {
                    scrollRef.current.scrollIntoView({
                        behavior: "smooth",
                        block: "center"
                    });
                }
            }, 150);
        }
    }, [open]);

    return (
        <div className="collapse bg-base-200 w-96 px-4 mx-auto max-w-90 md:max-w-full">
            <input type="checkbox" onChange={toggle} defaultChecked={true} />
            <div className="collapse-title text-xl font-medium text-center">
                {title}
            </div>
            <div ref={scrollRef} className="collapse-content min-w-0 overflow-hidden">
                {children}
            </div>
        </div>
    );
};

CollapseCol.propTypes = {
    title: PropTypes.string.isRequired,
    children: PropTypes.node,
    scroll: PropTypes.bool
};

export default CollapseCol;
