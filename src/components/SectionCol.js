import React from 'react';
import clsx from 'clsx';
import PropTypes from 'prop-types';
import DropdownButton from './DropdownButton';

// Renders section with centered title and flex column containing children
const SectionCol = ({ title, titleOptions, onOpenTitle, headerChildren, colRef, children }) => {
    return (
        <div className="section" ref={colRef}>
            <div className="section-header">
                {/* Title text + dropdown with titleOptions if prop used */}
                <div className={clsx(
                    "flex min-h-[3.75rem]",
                    titleOptions && "dropdown dropdown-center"
                )}>
                    <DropdownButton
                        className="section-title btn btn-ghost cursor-pointer"
                        onClick={onOpenTitle}
                    >
                        {title}
                    </DropdownButton>
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
    colRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    ]),
    children: PropTypes.node
};

export default SectionCol;
