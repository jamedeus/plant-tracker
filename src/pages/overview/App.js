import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import Navbar from 'src/components/Navbar';
import { useTheme } from 'src/context/ThemeContext';
import { sendPostRequest, parseDomContext } from 'src/util';
import FloatingFooter from 'src/components/FloatingFooter';
import PrintModal, { openPrintModal } from './PrintModal';
import { useIsBreakpointActive } from 'src/useBreakpoint';
import Layout from './Layout';

// Dropdown with links to jump to plant or group columns
// Only rendered on mobile layout (both columns always visible on desktop)
const QuickNavigation = ({ plantsColRef, groupsColRef }) => {
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
        <ul tabIndex={0} className="dropdown-options mt-3 w-24">
            <li className="mx-auto"><a onClick={jumpToPlants}>
                Plants
            </a></li>
            <li className="mx-auto"><a onClick={jumpToGroups}>
                Groups
            </a></li>
        </ul>
    );
};

QuickNavigation.propTypes = {
    plantsColRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    ]).isRequired,
    groupsColRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    ]).isRequired
};

// Top-left menu button contents
const MenuOptions = ({ archivedOverview, toggleEditing }) => {
    // Get toggle theme option from context
    const { ToggleThemeOption } = useTheme();

    switch(archivedOverview) {
        case(true):
            return (
                <>
                    <li><a onClick={toggleEditing}>
                        Edit
                    </a></li>
                    <ToggleThemeOption />
                    <li><a href='/'>
                        Main overview
                    </a></li>
                </>
            );
        case(false):
            return (
                <>
                    <li><a onClick={toggleEditing}>
                        Edit
                    </a></li>
                    <li><a onClick={openPrintModal}>
                        Print QR Codes
                    </a></li>
                    <ToggleThemeOption />
                    <li><a href='/archived'>
                        Archived plants
                    </a></li>
                </>
            );
    }
};

MenuOptions.propTypes = {
    archivedOverview: PropTypes.bool.isRequired,
    toggleEditing: PropTypes.func.isRequired
};

function App() {
    // Load context set by django template
    const [plants, setPlants] = useState(() => {
        return parseDomContext("plants");
    });
    const [groups, setGroups] = useState(() => {
        return parseDomContext("groups");
    });

    // True if desktop layout, false if mobile
    const desktop = useIsBreakpointActive('md');
    // True if mobile layout with stacked plant and group columns
    // False if desktop layout (side by side columns) or only one column
    const stackedColumns = !desktop && plants.length > 0 && groups.length > 0;

    // Check URL to determine if viewing main overview or archive overview
    const archivedOverview = window.location.pathname === '/archived';

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
                    alert('Failed to fetch current state, page may be outdated');
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

    // Handler for edit option in top-left dropdown
    // Toggle editing state, remove focus (closes dropdown)
    const toggleEditing = () => {
        setEditing(!editing);
        document.activeElement.blur();
    };

    // Handler for delete button that appears while editing
    const handleDelete = () => {
        const selectedPlants = getSelectedPlants();
        // Send delete request for each selected plant, remove uuid from state
        selectedPlants.forEach(async plant_id => {
            await sendPostRequest('/delete_plant', {plant_id: plant_id});
        });
        setPlants(plants.filter(
            plant => !selectedPlants.includes(plant.uuid))
        );

        const selectedGroups = getSelectedGroups();
        // Send delete request for each selected group, remove uuid from state
        selectedGroups.forEach(async group_id => {
            await sendPostRequest('/delete_group', {group_id: group_id});
        });
        setGroups(groups.filter(
            group => !selectedGroups.includes(group.uuid))
        );

        // Reset editing state
        setEditing(false);
    };

    // Handler for archive button (main overview) and un-archive button
    // (archive overview) that appear while editing. POSTS selected plants and
    // groups to backend then removes from frontend state.
    // Takes bool argument (true if archiving, false if un-archiving)
    const handleArchive = (archived) => {
        const selectedPlants = getSelectedPlants();
        // Send archive request for each selected plant, remove uuid from state
        selectedPlants.forEach(async plant_id => {
            await sendPostRequest(
                '/archive_plant',
                {plant_id: plant_id, archived: archived}
            );
        });
        setPlants(plants.filter(
            plant => !selectedPlants.includes(plant.uuid))
        );


        const selectedGroups = getSelectedGroups();
        // Send archive request for each selected group, remove uuid from state
        selectedGroups.forEach(async group_id => {
            await sendPostRequest(
                '/archive_group',
                {group_id: group_id, archived: archived}
            );
        });
        setGroups(groups.filter(
            group => !selectedGroups.includes(group.uuid))
        );

        // Reset editing state
        setEditing(false);
    };

    return (
        <div className="container flex flex-col min-h-screen mx-auto pb-16">
            <Navbar
                menuOptions={<MenuOptions
                    archivedOverview={archivedOverview}
                    toggleEditing={toggleEditing}
                />}
                title={archivedOverview ? "Archived" : "Plant Overview"}
                titleOptions={stackedColumns ? (
                    <QuickNavigation
                        plantsColRef={plantsColRef}
                        groupsColRef={groupsColRef}
                    />
                ) : null}
            />

            <Layout
                plants={plants}
                groups={groups}
                selectedPlantsRef={selectedPlantsRef}
                selectedGroupsRef={selectedGroupsRef}
                editing={editing}
                plantsColRef={plantsColRef}
                groupsColRef={groupsColRef}
            />

            <FloatingFooter visible={editing}>
                <button className="btn btn-neutral mr-4" onClick={() => setEditing(false)}>
                    Cancel
                </button>
                {archivedOverview ? (
                    <button className="btn mx-4" onClick={() => handleArchive(false)}>
                        Un-archive
                    </button>
                ) : (
                    <button className="btn mx-4" onClick={() => handleArchive(true)}>
                        Archive
                    </button>
                )}
                <button className="btn btn-error ml-4" onClick={handleDelete}>
                    Delete
                </button>
            </FloatingFooter>

            <PrintModal />
        </div>
    );
}

export default App;
