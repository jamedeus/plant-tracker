import React from 'react';
import PropTypes from 'prop-types';

// Renders section with centered title and flex column containing children
const SectionCol = ({ title, children }) => {
    return (
        <div className="section">
            <div className="section-title">
                {title}
            </div>
            <div className="section-content">
                {children}
            </div>
        </div>
    );
};

SectionCol.propTypes = {
    title: PropTypes.string.isRequired,
    children: PropTypes.node
};

export default SectionCol;
