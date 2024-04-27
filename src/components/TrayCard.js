import React from 'react';
import PropTypes from 'prop-types';

const TrayCard = ({ name, plants, uuid, linkPage=true }) => {

    // Click handler, redirects to manage_tray unless linkpage arg is false
    const manageLink = () => {
        window.location.href = `/manage/${uuid}`;
    };

    return (
        <div
            className={
                `card bg-neutral text-neutral-content mx-auto w-full
                ${linkPage ? 'cursor-pointer' : ''}`
            }
            onClick={linkPage ? manageLink : null}
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
    uuid: PropTypes.string,
    linkPage: PropTypes.bool
};

export default TrayCard;
