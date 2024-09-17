import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

// Renders DaisyUI collapse with centered title and vertical column of nodes
const CollapseCol = ({ title, children, openRef, scroll=false }) => {
    // Track collapse open state
    const [open, setOpen] = useState(openRef.current);

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

        // Keep upstream ref in sync (persist state between re-renders)
        openRef.current = open;
    }, [open]);

    return (
        <div className="collapse bg-base-200 w-96 px-4 mx-auto max-w-90 md:max-w-full">
            <input type="checkbox" onChange={toggle} defaultChecked={open} />
            <div className="collapse-title text-xl font-medium text-center">
                {title}
            </div>
            <div ref={scrollRef} className="collapse-content min-w-0">
                {children}
            </div>
        </div>
    );
};

CollapseCol.propTypes = {
    title: PropTypes.string.isRequired,
    children: PropTypes.node,
    openRef: PropTypes.object.isRequired,
    scroll: PropTypes.bool
};

export default CollapseCol;
