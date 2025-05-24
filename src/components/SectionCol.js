import React from 'react';
import PropTypes from 'prop-types';

// Renders section with centered title and flex column containing children
const SectionCol = ({ title, titleOptions, onOpenTitle, children }) => {
    return (
        <div className="section">
            <div className="section-title dropdown dropdown-center">
                <div
                    tabIndex={0}
                    role="button"
                    className="section-title-font btn btn-ghost cursor-pointer"
                    onClick={onOpenTitle}
                >
                    {title}
                </div>
                <div className="dropdown-content z-50 mt-14">
                    {titleOptions}
                </div>
            </div>
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
    children: PropTypes.node
};

export default SectionCol;
