import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useCloseWithEscKey } from 'src/hooks/useCloseWithEscKey';
import 'src/css/title-drawer.css';
import clsx from 'clsx';

const TitleDrawer = ({ open, onClose, children }) => {
    // Close drawer by pressing escape key
    useCloseWithEscKey(open, onClose);

    const ref = useRef(null);
    useEffect(() => {
        if (!open) {
            return;
        }

        // Close if user clicks body outside drawer.
        // Keep open if click is inside a modal (ie if user opens edit modal and
        // then submits the drawer should stay open so they can see changes).
        // Ignore click on title button (let title button toggle visibility).
        const handleClickOutside = (e) => {
            const insideDrawer = ref.current?.contains(e.target);
            const insideModal = e.target.closest('.modal-box');
            const titleButton = e.target.closest('[data-title-click-listener]');
            if (!insideDrawer && !insideModal && !titleButton) {
                onClose();
            }
        };
        document.addEventListener('pointerdown', handleClickOutside, true);

        return () => {
            document.removeEventListener('pointerdown', handleClickOutside, true);
        };
    }, [ref, open, onClose]);

    return (
        <div
            className={clsx("title-drawer", open && "title-drawer-open")}
            data-testid="title-drawer"
            ref={ref}
        >
            <div className="title-drawer-contents">
                {children}
            </div>
        </div>
    );
};

TitleDrawer.propTypes = {
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    children: PropTypes.node.isRequired
};

export default TitleDrawer;
