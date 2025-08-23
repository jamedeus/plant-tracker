import React, { useState, useLayoutEffect, useRef, memo } from 'react';
import PropTypes from 'prop-types';
import DropdownMenu from 'src/components/DropdownMenu';
import clsx from 'clsx';

// Button with icon, used for dropdown and hidden placeholder on right side
const DropdownButton = memo(function DropdownButton() {
    return (
        <div
            tabIndex={0}
            role="button"
            className="btn btn-ghost btn-circle size-12"
            aria-label="Navigation menu"
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                className="size-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 6h16M4 12h16M4 18h7"
                />
            </svg>
        </div>
    );
});

// Renders navbar with dropdown on left and dynamically-sized title in center
// Optional titleOptions param will be shown in dropdown when title is clicked
// Both option params must be list of <li> elements
// the top-left dropdown and title dropdown respectively
const Navbar = memo(function Navbar({ menuOptions, title, titleOptions, topRightButton }) {
    // Create refs for navbar and title text (used to read widths)
    const navbarRef = useRef(null);
    const titleRef = useRef(null);
    // Create state for title font size (calculated from navbar width)
    const [titleFontSize, setTitleFontSize] = useState(32);

    // Clicking title scrolls to top if titleOptions param not given
    const jumpToTop = () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    useLayoutEffect(() => {
        // Takes navbar and dropdown button elements, returns max title width
        const getMaxWidth = (navbar, button) => {
            // Full width minus button, hidden button, and 2rem horizontal padding
            return navbar.offsetWidth - button.offsetWidth * 2 - 32;
        };

        const adjustTitleFont = () => {
            /* istanbul ignore else */
            if (navbarRef.current && titleRef.current) {
                // Get maximum title width that won't overlap menu button
                const maxWidth = getMaxWidth(
                    navbarRef.current,
                    navbarRef.current.children[0]
                );

                // Increase font size until maxWidth reached
                let newSize = titleFontSize;
                while (titleRef.current.offsetWidth < maxWidth && newSize < 32) {
                    newSize++;
                    titleRef.current.style.fontSize = `${newSize}px`;
                }
                // Reduce font size until title fits available space
                while (titleRef.current.offsetWidth > maxWidth && newSize > 14) {
                    newSize--;
                    titleRef.current.style.fontSize = `${newSize}px`;
                }

                // Render with new font size
                setTitleFontSize(newSize);
            }
        };

        // Calculate font size on load, update when window resizes
        adjustTitleFont();
        window.addEventListener('resize', adjustTitleFont);

        return () => {
            window.removeEventListener('resize', adjustTitleFont);
        };
    }, [title, titleFontSize]);

    return (
        <div
            ref={navbarRef}
            className="navbar bg-base-100 fixed top-0 z-99"
        >
            {/* Top left dropdown button */}
            <div className="dropdown justify-start min-w-12">
                <DropdownButton />
                <DropdownMenu className="mt-3">
                    {menuOptions}
                </DropdownMenu>
            </div>

            {/* Title */}
            <div
                className="mx-auto shrink min-w-0"
                onClick={titleOptions ? null : jumpToTop}
                title={titleOptions ? null : "Scroll to top"}
            >
                <div className="dropdown dropdown-center w-full">
                    {/* Button if dropdown options exist, otherwise text */}
                    <a
                        tabIndex={titleOptions ? 0 : -1}
                        role={titleOptions ? "button" : "heading"}
                        className={clsx(
                            "w-full px-0 text-nowrap font-semibold",
                            titleOptions && "btn btn-ghost border-0"
                        )}
                    >
                        <span
                            ref={titleRef}
                            className="px-4 leading-[2.75rem] truncate"
                            style={{ fontSize: `${titleFontSize}px` }}
                        >
                            {title}
                        </span>
                    </a>
                    {titleOptions &&
                        <div tabIndex={0} className="dropdown-content z-1 flex">
                            {titleOptions}
                        </div>
                    }
                </div>
            </div>

            {/* Spacer to center title */}
            <div className="justify-end min-w-12">
                {topRightButton}
            </div>
        </div>
    );
});

Navbar.propTypes = {
    menuOptions: PropTypes.node,
    title: PropTypes.string.isRequired,
    titleOptions: PropTypes.node,
    topRightButton: PropTypes.node
};

export default Navbar;
