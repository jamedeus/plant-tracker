import React from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';

// Renders section with centered title and flex column containing children
const SectionCol = ({ title, titleOptions, children }) => {
    return (
        <div className="section">
            <div className="section-title dropdown dropdown-center">
                <div
                    tabIndex={0}
                    role="button"
                    className={clsx(
                        "section-title-font",
                        titleOptions && "btn btn-ghost cursor-pointer"
                    )}
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
    children: PropTypes.node
};

export default SectionCol;
