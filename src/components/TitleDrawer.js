import React from 'react';
import PropTypes from 'prop-types';
import { useCloseWithEscKey } from 'src/hooks/useCloseWithEscKey';
import 'src/css/title-drawer.css';
import clsx from 'clsx';

const TitleDrawer = ({ open, onClose, children }) => {
    // Close drawer by pressing escape key
    useCloseWithEscKey(open, onClose);

    return (
        <div className={clsx("title-drawer", open && "title-drawer-open")}>
            {/* Full screen overlay when open (click outside to close) */}
            <div
                onClick={onClose}
                className={clsx(
                    "fixed inset-0 cursor-pointer z-98",
                    !open && "hidden"
                )}
                data-testid="title-drawer-menu-overlay"
            />
            {/* Contents */}
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
