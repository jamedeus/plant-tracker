import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';

// Reusable pager component, intended to be rendered as a child of LazyModal
// Renders each child as a separate page, adds back/next buttons to switch pages
const ModalPages = ({ children }) => {
    // Normalize children to array (otherwise will fail with only 1 page)
    const pages = React.Children.toArray(children);
    const pageCount = pages.length;

    // Currently visible page
    const [index, setIndex] = useState(0);
    // Prevent clicking next/prev while animation in progress
    const [isAnimating, setIsAnimating] = useState(false);

    // Change visible page unless animation in progress or target invalid
    const goToPage = useCallback((target) => {
        if (isAnimating) return;
        if (target < 0 || target > pageCount - 1 || target === index) return;
        setIsAnimating(true);
        setIndex(target);
    }, [index, isAnimating, pageCount]);

    // Allows changing page again once animation done
    const onTransitionEnd = useCallback(() => setIsAnimating(false), []);

    const backHidden = index === 0;
    const nextHidden = index === pageCount - 1;

    return (
        <div className='modal-pages flex flex-col overflow-hidden'>
            {/* Track renders all pages, horizontally slides to current page */}
            <div
                className="flex transition-transform duration-300 ease-out"
                style={{ transform: `translateX(-${index * 100}%)` }}
                onTransitionEnd={onTransitionEnd}
                data-testid="modal-pages-track"
            >
                {pages.map((content, i) => (
                    <div
                        key={`page-${i}`}
                        data-current-page={i === index}
                        className="flex-shrink-0 w-full box-border my-4"
                    >
                        {content}
                    </div>
                ))}
            </div>

            {/* Nav buttons, fades out back on first page, next on last page */}
            <div className="flex w-full justify-between">
                <button
                    id="modal-pages-back"
                    className={clsx(
                        'btn transition-opacity duration-300',
                        backHidden && 'opacity-0 pointer-events-none'
                    )}
                    aria-disabled={backHidden}
                    onClick={() => goToPage(index - 1)}
                >
                    Back
                </button>

                <button
                    id="modal-pages-next"
                    className={clsx(
                        'btn btn-accent transition-opacity duration-300',
                        nextHidden && 'opacity-0 pointer-events-none'
                    )}
                    aria-disabled={nextHidden}
                    onClick={() => goToPage(index + 1)}
                >
                    Next
                </button>
            </div>
        </div>
    );
};

ModalPages.propTypes = {
    children: PropTypes.node.isRequired
};

export default ModalPages;
