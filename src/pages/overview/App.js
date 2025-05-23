import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Navbar from 'src/components/Navbar';
import DropdownMenu from 'src/components/DropdownMenu';
import ToggleThemeOption from 'src/components/ToggleThemeOption';
import { sendPostRequest, parseDomContext } from 'src/util';
import FloatingFooter from 'src/components/FloatingFooter';
import PrintModal, { openPrintModal } from './PrintModal';
import { openErrorModal } from 'src/components/ErrorModal';
import { useIsBreakpointActive } from 'src/useBreakpoint';
import HoldToConfirm from 'src/components/HoldToConfirm';
import Layout from './Layout';

function App() {
    // Load context set by django template
    const [plants, setPlants] = useState(() => {
        return parseDomContext("plants");
    });
    const [groups, setGroups] = useState(() => {
        return parseDomContext("groups");
    });
    const [showArchive, setShowArchive] = useState(() => {
        return parseDomContext("show_archive");
    });
    // Controls whether dropdown contains user profile link
    const userAccountsEnabled = useMemo(() => (
        parseDomContext("user_accounts_enabled")
    ), []);

    // True if desktop layout, false if mobile
    const desktop = useIsBreakpointActive('md');
    // True if mobile layout with stacked plant and group columns
    // False if desktop layout (side by side columns) or only one column
    const stackedColumns = !desktop && plants.length > 0 && groups.length > 0;

    // Check URL to determine if viewing main overview or archive overview
    const archivedOverview = window.location.pathname === '/archived';

    // Get page title (used in navbar header)
    const pageTitle = useMemo(() => document.title);

    // Request new state from backend if user navigates to overview by pressing
    // back button (last watered/details may be outdated if coming from manage)
    useEffect(() => {
        const handleBackButton = async (event) => {
            if (event.persisted) {
                const response = await fetch('/get_overview_state');
                if (response.ok) {
                    const data = await response.json();
                    setPlants(data['plants']);
                    setGroups(data['groups']);
                } else {
                    alert('Failed to fetch new data, page may be outdated');
                }
            }
        };

        // Add listener on mount, remove on unmount
        if (!archivedOverview) {
            window.addEventListener('pageshow', handleBackButton);
            return () => {
                window.removeEventListener('pageshow', handleBackButton);
            };
        }
    }, []);

    // State object to track edit mode (shows checkbox for each card when true)
    const [editing, setEditing] = useState(false);

    const toggleEditing = useCallback(() => {
        setEditing(!editing);
    }, [editing]);

    // FormRefs for PlantsCol and GroupsCol, used to read user selection
    const selectedPlantsRef = useRef(null);
    const selectedGroupsRef = useRef(null);

    // Returns array of selected plant UUIDs parsed from PlantsCol form
    const getSelectedPlants = () => {
        if (selectedPlantsRef.current) {
            const selected = new FormData(selectedPlantsRef.current);
            return Array.from(selected.keys());
        } else {
            return [];
        }
    };

    // Returns array of selected group UUIDs parsed from GroupsCol form
    const getSelectedGroups = () => {
        if (selectedGroupsRef.current) {
            const selected = new FormData(selectedGroupsRef.current);
            return Array.from(selected.keys());
        } else {
            return [];
        }
    };

    // Refs used to jump to top of plant and group columns
    const plantsColRef = useRef(null);
    const groupsColRef = useRef(null);

    // Handler for delete button that appears while editing
    const handleDelete = async () => {
        // Get combined array of selected plant and group uuids
        const selectedPlants = getSelectedPlants();
        const selectedGroups = getSelectedGroups();
        const selectedUuids = selectedPlants.concat(selectedGroups);

        // Don't send empty request if nothing selected
        if (!selectedUuids.length) {
            return;
        }

        // Send /bulk_delete_plants_and_groups request with all selected UUIDs
        const response = await sendPostRequest(
            '/bulk_delete_plants_and_groups',
            {uuids: selectedPlants.concat(selectedGroups)}
        );
        // Remove deleted UUIDs from state
        if (response.ok) {
            const data = await response.json();
            setPlants(plants.filter(
                plant => !data['deleted'].includes(plant.uuid))
            );
            setGroups(groups.filter(
                group => !data['deleted'].includes(group.uuid))
            );
        } else {
            const data = await response.json();
            openErrorModal(`Failed to delete: ${data.failed.join(', ')}`);
        }

        // Reset editing state
        setEditing(false);
    };

    // Handler for archive button (main overview) and un-archive button
    // (archive overview) that appear while editing. POSTS selected plants and
    // groups to backend then removes from frontend state.
    const handleArchive = async () => {
        // Main overview: set payload arg to true (archive plants)
        // Archived overview: set payload arg to false (un-archive plants)
        const archived = !archivedOverview;

        // Get combined array of selected plant and group uuids
        const selectedPlants = getSelectedPlants();
        const selectedGroups = getSelectedGroups();
        const selectedUuids = selectedPlants.concat(selectedGroups);

        // Don't send empty request if nothing selected
        if (!selectedUuids.length) {
            return;
        }

        // Send /bulk_archive_plants_and_groups request with all selected UUIDs
        const response = await sendPostRequest(
            '/bulk_archive_plants_and_groups',
            {
                uuids: selectedUuids,
                archived: archived
            }
        );
        // Remove deleted UUIDs from state
        if (response.ok) {
            const data = await response.json();
            const newPlants = plants.filter(
                plant => !data['archived'].includes(plant.uuid)
            );
            setPlants(newPlants);
            const newGroups = groups.filter(
                group => !data['archived'].includes(group.uuid)
            );
            setGroups(newGroups);

            // Ensure archive link visible in dropdown menu
            setShowArchive(archived);

            // Archived overview: redirect to overview if no plants or groups left
            if (archivedOverview && !newPlants.length && !newGroups.length) {
                window.location.href = "/";
            }
        } else {
            const data = await response.json();
            openErrorModal(`Failed to archive: ${data.failed.join(', ')}`);
        }

        // Reset editing state
        setEditing(false);
    };

    // Top left corner dropdown options
    const DropdownMenuOptions = useMemo(() => {
        // Toggle editing state, remove focus (closes dropdown)
        const toggleEditing = () => {
            setEditing(!editing);
            document.activeElement.blur();
        };

        // Only add edit option if at least 1 plant or group
        const showEditOption = plants.length > 0 || groups.length > 0;

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
                {/* Show edit option if at least 1 plant or group exists */}
                {showEditOption && (
                    <li><a onClick={toggleEditing}>
                        Edit
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
    }, [editing, ToggleThemeOption]);

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
            />

            <Layout
                plants={plants}
                groups={groups}
                selectedPlantsRef={selectedPlantsRef}
                selectedGroupsRef={selectedGroupsRef}
                editing={editing}
                toggleEditing={toggleEditing}
                plantsColRef={plantsColRef}
                groupsColRef={groupsColRef}
            />

            <FloatingFooter visible={editing}>
                <button
                    className="btn btn-neutral"
                    onClick={() => setEditing(false)}
                >
                    Cancel
                </button>

                <button
                    className="btn"
                    onClick={() => handleArchive()}
                >
                    {archivedOverview ? "Un-archive" : "Archive"}
                </button>
                <HoldToConfirm
                    callback={handleDelete}
                    timeout={2500}
                    buttonText="Delete"
                    tooltipText="Hold to confirm"
                />
            </FloatingFooter>

            <PrintModal />
        </div>
    );
}

export default App;
