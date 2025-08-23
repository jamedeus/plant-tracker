import React, { useRef, memo } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { ChevronDownIcon } from '@heroicons/react/16/solid';
import uuidPropType from 'src/types/uuidPropType';

// Renders card representing a Plant or Group entry
// - uuid: Plant or Group uuid (used for manage page link)
// - title: Large title text (Plant or Group display name)
// - subtitle: Normal sized text under title (last watered, plants in group)
// - details: Contents of details dropdown, hidden until expand button clicked
// - thumbnail: Image rendered on left side of card
// - archived: Card appears in grayscale if true, otherwise normal
const InstanceCard = memo(function InstanceCard({
    uuid,
    title,
    subtitle,
    details,
    thumbnail,
    archived
}) {
    // Ref for hidden checkbox that controls details collapse open/close state
    const checkboxRef = useRef(null);

    // Toggle open/close state (prevent click propagating to <Link>)
    const onToggleClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        checkboxRef.current.checked = !checkboxRef.current.checked;
    };

    return (
        <Link
            to={`/manage/${uuid}`}
            className={clsx(
                'collapse cursor-pointer group rounded-2xl',
                'bg-neutral text-neutral-content',
                archived && 'grayscale'
            )}
            aria-label={`Go to ${title} page`}
        >
            {/* Hidden checkbox controls open/close state */}
            <input
                type="checkbox"
                className="hidden pointer-events-none"
                ref={checkboxRef}
            />

            <div className='collapse-title min-size-0'>
                <div className='card card-side relative h-24'>
                    {thumbnail && (
                        <figure className="h-24 w-20 min-size-20">
                            <img
                                loading="lazy"
                                draggable={false}
                                src={thumbnail}
                                className="size-full object-cover"
                                alt={`${title} photo`}
                            />
                        </figure>
                    )}

                    {/* Card body */}
                    <div className={clsx(
                        'card-body max-w-full my-auto',
                        thumbnail ? 'text-start' : 'text-center'
                    )}>
                        <h2 className={clsx(
                            'card-title line-clamp-1 break-words',
                            thumbnail ? 'pr-8' : 'text-center px-8'
                        )}>
                            {title}
                        </h2>
                        {subtitle}
                    </div>

                    {/* Button opens/closes collapse with details */}
                    <button
                        tabIndex={-1}
                        className="btn-close absolute right-2 top-8 z-40"
                        onClick={onToggleClick}
                        aria-label="Show or hide details"
                    >
                        <ChevronDownIcon className={clsx(
                            "min-size-8 transition-transform duration-200",
                            "rotate-0 group-has-checked:rotate-180"
                        )} />
                    </button>
                </div>
            </div>
            {/* Details collapse, closed until button clicked */}
            <div className="collapse-content min-w-0">
                <div className="pt-4">
                    {details}
                </div>
            </div>
        </Link>
    );
});

InstanceCard.propTypes = {
    uuid: uuidPropType.isRequired,
    title: PropTypes.string.isRequired,
    subtitle: PropTypes.node.isRequired,
    details: PropTypes.node.isRequired,
    thumbnail: PropTypes.string,
    archived: PropTypes.bool
};

export default InstanceCard;
