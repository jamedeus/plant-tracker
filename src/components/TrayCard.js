import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/16/solid';
import TrayDetails from 'src/components/TrayDetails';

const TrayCard = ({ name, plants, uuid, location, description, linkPage=true }) => {
    // Track details collapse open state
    const [open, setOpen] = useState(false);

    // Button handler toggles collapse state, prevents click propagating
    // to card (redirects to manage_tray page unless linkPage arg is false)
    const toggle = (e) => {
        setOpen(!open);
        e.stopPropagation();
    };

    // Click handler, redirects to manage_tray unless linkPage arg is false
    const manageLink = () => {
        window.location.href = `/manage/${uuid}`;
    };

    // Renders collapse with Tray details, opened with arrow button
    const DetailsSection = () => {
        return (
            <div className={
                `collapse bg-neutral rounded-t-none cursor-default
                ${open ? "pt-4" : ""}`
            }>
                <input
                    type="checkbox"
                    className="hidden"
                    onChange={toggle}
                    defaultChecked={open}
                />
                <div className="collapse-content">
                    <TrayDetails
                        location={location}
                        description={description}
                    />
                </div>
            </div>
        );
    };

    return (
        <>
            <div
                className={
                    `card bg-neutral text-neutral-content mx-auto w-full
                    ${linkPage ? 'cursor-pointer' : 'cursor-default'}
                    ${open ? "rounded-b-none" : ""}`
                }
                onClick={linkPage ? manageLink : null}
            >
                <div className="card-body text-center">
                    <h2 className="card-title mx-auto">{name}</h2>
                    <p>Contains {plants} plants</p>
                </div>

                <button
                    tabIndex={0}
                    role="button"
                    className="btn-close absolute right-2 top-8 z-40"
                    onClick={(e) => toggle(e)}
                >
                    {(() => {
                        switch(open) {
                            case(true):
                                return <ChevronUpIcon className="w-8 h-8" />;
                            case(false):
                                return <ChevronDownIcon className="w-8 h-8" />;
                        }
                    })()}
                </button>
            </div>
            <DetailsSection />
        </>
    );
};

TrayCard.propTypes = {
    name: PropTypes.string,
    plants: PropTypes.number,
    uuid: PropTypes.string,
    location: PropTypes.string,
    description: PropTypes.string,
    linkPage: PropTypes.bool
};

export default TrayCard;
