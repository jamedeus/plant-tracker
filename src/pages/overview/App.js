import React, { useState, useEffect, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import Navbar from 'src/components/Navbar';
import DropdownMenu from 'src/components/DropdownMenu';
import ToggleThemeOption from 'src/components/ToggleThemeOption';
import { parseDomContext } from 'src/util';
import PrintModal, { openPrintModal } from './PrintModal';
import { useIsBreakpointActive } from 'src/hooks/useBreakpoint';
import Layout from './Layout';
import QrScannerButton from 'src/components/QrScannerButton';
import 'src/css/index.css';

function App({ initialState }) {
    // Initialize from SPA-provided state
    const [plants, setPlants] = useState(initialState.plants);
    const [groups, setGroups] = useState(initialState.groups);
    const [showArchive, setShowArchive] = useState(initialState.show_archive);
    const pageTitle = useMemo(() => initialState.title);

    useEffect(() => {
        setPlants(initialState.plants);
        setGroups(initialState.groups);
        setShowArchive(initialState.show_archive);
    }, [initialState]);

    // Controls whether dropdown contains user profile link
    const userAccountsEnabled = useMemo(() => (
        parseDomContext("user_accounts_enabled")
    ), []);

    // True if desktop layout, false if mobile
    const desktop = useIsBreakpointActive('md');
    // True if mobile layout with stacked plant and group columns
    // False if desktop layout (side by side columns) or only one column
    const stackedColumns = !desktop &&
        Object.keys(plants).length > 0 &&
        Object.keys(groups).length > 0;

    // Check URL to determine if viewing main overview or archive overview
    const archivedOverview = window.location.pathname === '/archived';

    // Refs used to jump to top of plant and group columns
    const plantsColRef = useRef(null);
    const groupsColRef = useRef(null);

    // Top left corner dropdown options
    const DropdownMenuOptions = useMemo(() => {
        return (
            <>
                {/* Main overview: Link to archive overview if it exists */}
                {(!archivedOverview && showArchive) && (
                    <li><Link to='/archived'>
                        Archived plants
                    </Link></li>
                )}
                {/* Archive overview: Link back to main overview */}
                {archivedOverview && (
                    <li><Link to='/'>
                        Main overview
                    </Link></li>
                )}
                {/* Link to user profile unless accounts disabled */}
                {userAccountsEnabled && (
                    <li><Link to='/accounts/profile/'>
                        User profile
                    </Link></li>
                )}
                {/* Main overview: Show Print QR Codes option */}
                {!archivedOverview && (
                    <li><a onClick={openPrintModal}>
                        Print QR Codes
                    </a></li>
                )}
                <ToggleThemeOption />

            </>
        );
    }, [ToggleThemeOption, showArchive]);

    // Dropdown with links to jump to plant or group columns
    // Only rendered on mobile layout (both columns always visible on desktop)
    const TitleQuickNavigation = useMemo(() => {
        const jumpToPlants = () => {
            plantsColRef.current.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
            document.activeElement.blur();
        };

        const jumpToGroups = () => {
            groupsColRef.current.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
            document.activeElement.blur();
        };

        return (
            <DropdownMenu className="mt-3 w-24">
                <li><a className="flex justify-center" onClick={jumpToPlants}>
                    Plants
                </a></li>
                <li><a className="flex justify-center" onClick={jumpToGroups}>
                    Groups
                </a></li>
            </DropdownMenu>
        );
    }, []);

    return (
        <div className="container flex flex-col items-center mx-auto pb-28">
            <Navbar
                menuOptions={DropdownMenuOptions}
                title={pageTitle}
                titleOptions={stackedColumns ? TitleQuickNavigation : null}
                topRightButton={<QrScannerButton />}
            />

            <Layout
                plants={plants}
                groups={groups}
                setPlants={setPlants}
                setGroups={setGroups}
                plantsColRef={plantsColRef}
                groupsColRef={groupsColRef}
                archivedOverview={archivedOverview}
                setShowArchive={setShowArchive}
            />

            <PrintModal />
        </div>
    );
}

App.propTypes = {
    initialState: PropTypes.shape({
        plants: PropTypes.object.isRequired,
        groups: PropTypes.object.isRequired,
        show_archive: PropTypes.bool.isRequired,
        title: PropTypes.string.isRequired,
    }),
};

export default App;
