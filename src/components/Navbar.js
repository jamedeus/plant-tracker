import React, { useState, useLayoutEffect, useRef, memo } from 'react';
import PropTypes from 'prop-types';

// Button with icon, used for dropdown and hidden placeholder on right side
const DropdownButton = memo(function DropdownButton() {
    return (
        <div tabIndex={0} role="button" className="btn btn-ghost btn-circle">
            <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
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
// Optional onOpenMenu and onOpenTitle params are functions called when opening
// the top-left dropdown and title dropdown respectively
const Navbar = memo(function Navbar({ menuOptions, onOpenMenu, title, titleOptions, onOpenTitle }) {
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
            className="navbar bg-base-100 mb-4 sticky top-0 z-[99]"
        >
            {/* Top left dropdown button */}
            <div
                className="dropdown justify-start min-w-12"
                onFocus={onOpenMenu}
            >
                <DropdownButton />
                <ul tabIndex={0} className="dropdown-options mt-3 w-52">
                    {menuOptions}
                </ul>
            </div>

            {/* Title */}
            <div
                className="mx-auto shrink min-w-0"
                onClick={titleOptions ? null : jumpToTop}
                title={titleOptions ? null : "Scroll to top"}
            >
                <div
                    className="dropdown dropdown-center w-full"
                    onFocus={onOpenTitle}
                >
                    <a
                        tabIndex={0}
                        role="button"
                        className="btn btn-ghost w-full px-0 text-nowrap"
                    >
                        <span
                            ref={titleRef}
                            className="px-4 leading-[2.75rem] truncate"
                            style={{ fontSize: `${titleFontSize}px` }}
                        >
                            {title}
                        </span>
                    </a>
                    <div tabIndex={0} className="dropdown-content z-[1] flex">
                        {titleOptions}
                    </div>
                </div>
            </div>

            {/* Spacer to center title */}
            <div className="justify-end min-w-12"></div>
        </div>
    );
});

Navbar.propTypes = {
    menuOptions: PropTypes.node,
    onOpenMenu: PropTypes.func,
    title: PropTypes.string.isRequired,
    titleOptions: PropTypes.node,
    onOpenTitle: PropTypes.func
};

export default Navbar;
