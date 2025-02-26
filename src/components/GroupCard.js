import React, { useState } from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';
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

    return (
        <a
            href={linkPage ? `/manage/${uuid}` : null}
            className={clsx(
                'collapse bg-neutral',
                archived && 'grayscale',
                linkPage && 'cursor-pointer',
                open ? 'collapse-open' : 'collapse-close'
            )}
        >
            <div className='collapse-title !p-0 min-w-0 min-h-0'>
                <div className='card text-neutral-content relative'>
                    {/* Card body */}
                    <div className='card-body cursor-default text-center'>
                        <h2 className='card-title mx-auto'>{display_name}</h2>
                        <p>Contains {plants} plants</p>
                    </div>

                    {/* Button opens/closes collapse with details */}
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
            </div>
            {/* Group details collapse, closed until button clicked */}
            <div className="collapse-content">
                <div className="pt-4">
                    <GroupDetails
                        location={location}
                        description={description}
                    />
                </div>
            </div>
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
