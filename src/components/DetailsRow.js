import React from 'react';
import PropTypes from 'prop-types';

// Renders a single grid row in PlantDetails and GroupDetails
const DetailsRow = ({ label, value }) => (
    <>
        <span className="text-left font-bold break-keep">{`${label}:`}</span>
        <span className="text-left line-clamp-1 break-all">{value}</span>
    </>
);

DetailsRow.propTypes = {
    label: PropTypes.string.isRequired,
    value: PropTypes.any.isRequired
};

export default DetailsRow;
