import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/16/solid';
import GroupDetails from 'src/components/GroupDetails';

const GroupCard = ({ display_name, plants, uuid, location, description, linkPage=true, archived=false }) => {
    // Track details collapse open state
    const [open, setOpen] = useState(false);

    // Button handler toggles collapse state, prevents click propagating
    // to card (redirects to manage_group page unless linkPage arg is false)
    const toggle = (e) => {
        setOpen(!open);
        e.preventDefault();
        e.stopPropagation();
    };

    // Renders collapse with Group details, opened with arrow button
    const DetailsSection = () => {
        return (
            <div className={
                `collapse bg-neutral rounded-t-none cursor-default
                ${open ? "pt-4" : ""} ${archived ? 'grayscale' : ''}`
            }>
                <input
                    type="checkbox"
                    className="hidden"
                    onChange={toggle}
                    defaultChecked={open}
                />
                <div className="collapse-content">
                    <GroupDetails
                        location={location}
                        description={description}
                    />
                </div>
            </div>
        );
    };

    return (
        <a
            href={linkPage ? `/manage/${uuid}` : null}
            className={linkPage ? 'cursor-pointer' : null}
        >
            <div
                className={
                    `card bg-neutral text-neutral-content mx-auto w-full
                    ${open ? "rounded-b-none" : ""}
                    ${archived ? 'grayscale' : ''}`
                }
            >
                <div className="card-body text-center">
                    <h2 className="card-title mx-auto">{display_name}</h2>
                    <p>Contains {plants} plants</p>
                </div>

                <button
                    tabIndex={0}
                    role="button"
                    className="btn-close absolute right-2 top-8 z-40"
                    onClick={(e) => toggle(e)}
                >
                    {open
                        ? <ChevronUpIcon className="w-8 h-8" />
                        : <ChevronDownIcon className="w-8 h-8" />
                    }
                </button>
            </div>
            <DetailsSection />
        </a>
    );
};

GroupCard.propTypes = {
    display_name: PropTypes.string.isRequired,
    plants: PropTypes.number.isRequired,
    uuid: PropTypes.string.isRequired,
    location: PropTypes.string,
    description: PropTypes.string,
    linkPage: PropTypes.bool,
    archived: PropTypes.bool
};

export default GroupCard;
