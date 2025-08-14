import React, { useState, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import Navbar from 'src/components/Navbar';
import DropdownMenu from 'src/components/DropdownMenu';
import ToggleThemeOption from 'src/components/ToggleThemeOption';
import { parseDomContext } from 'src/util';
import PrintModal, { openPrintModal } from './PrintModal';
import { useBackButton } from 'src/useBackButton';
import { useIsBreakpointActive } from 'src/useBreakpoint';
import Layout from './Layout';
import QrScannerButton from 'src/components/QrScannerButton';

function App({ initialPlants, initialGroups, initialShowArchive }) {
    // Initialize entirely from SPA-provided state
    const [plants, setPlants] = useState(initialPlants);
    const [groups, setGroups] = useState(initialGroups);
    const [showArchive, setShowArchive] = useState(initialShowArchive);
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

    // Get page title (used in navbar header)
    const pageTitle = useMemo(() => document.title);

    // Request new state from backend if user navigates to overview by pressing
    // back button (last watered/details may be outdated if coming from manage)
    if (!archivedOverview) {
        useBackButton(async () => {
            const response = await fetch('/get_overview_state');
            if (response.ok) {
                const data = await response.json();
                setPlants(data.plants);
                setGroups(data.groups);
            } else {
                alert('Failed to fetch new data, page may be outdated');
            }
        });
    }

    // Refs used to jump to top of plant and group columns
    const plantsColRef = useRef(null);
    const groupsColRef = useRef(null);

    // Top left corner dropdown options
    const DropdownMenuOptions = useMemo(() => {
        return (
            <>
                {/* Main overview: Link to archive overview if it exists */}
                {(!archivedOverview && showArchive) && (
                    <li><a href='/archived'>
                        Archived plants
                    </a></li>
                )}
                {/* Archive overview: Link back to main overview */}
                {archivedOverview && (
                    <li><a href='/'>
                        Main overview
                    </a></li>
                )}
                {/* Link to user profile unless accounts disabled */}
                {userAccountsEnabled && (
                    <li><a href='/accounts/profile/'>
                        User profile
                    </a></li>
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
    }, [ToggleThemeOption]);

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
    initialPlants: PropTypes.object.isRequired,
    initialGroups: PropTypes.object.isRequired,
    initialShowArchive: PropTypes.bool.isRequired,
};

export default App;
