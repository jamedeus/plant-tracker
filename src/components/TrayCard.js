import React from 'react';
import PropTypes from 'prop-types';

const TrayCard = ({ name, plants, uuid }) => {
    return (
        <div
            className="card bg-neutral text-neutral-content mx-auto w-full cursor-pointer"
            onClick={() => window.location.href = `/manage/${uuid}`}
        >
            <div className="card-body text-center">
                <h2 className="card-title mx-auto">{name}</h2>
                <p>Contains {plants} plants</p>
            </div>
        </div>
    );
};

TrayCard.propTypes = {
    name: PropTypes.string,
    plants: PropTypes.number,
    uuid: PropTypes.string
};

export default TrayCard;
