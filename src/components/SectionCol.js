import React from 'react';
import PropTypes from 'prop-types';

// Renders section with centered title and flex column containing children
const SectionCol = ({ title, titleOptions, onOpenTitle, headerChildren, children }) => {
    return (
        <div className="section">
            <div className="section-header">
                {/* Title text + dropdown with titleOptions if prop used */}
                <div className="flex dropdown dropdown-center min-h-[3.75rem]">
                    <div
                        tabIndex={0}
                        role="button"
                        className="section-title btn btn-ghost cursor-pointer"
                        onClick={onOpenTitle}
                    >
                        {title}
                    </div>
                    <div className="dropdown-content z-50 mt-14">
                        {titleOptions}
                    </div>
                </div>
                {/* Header children (eg filter input just under title) */}
                {headerChildren}
            </div>
            {/* Actual contents (children) */}
            <div className="section-content">
                {children}
            </div>
        </div>
    );
};

SectionCol.propTypes = {
    title: PropTypes.string.isRequired,
    titleOptions: PropTypes.node,
    onOpenTitle: PropTypes.func,
    headerChildren: PropTypes.node,
    children: PropTypes.node
};

export default SectionCol;
