import React, { useState, useRef, useCallback, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import Setup from './Setup';
import EditModeFooter from './EditModeFooter';
import Navbar from 'src/components/Navbar';
import PlantsCol from 'src/components/PlantsCol';
import GroupsCol from 'src/components/GroupsCol';
import { hideToast } from 'src/components/Toast';
import DropdownMenu from 'src/components/DropdownMenu';
import AddEventsFooter from 'src/components/AddEventsFooter';
import QrScannerButton from 'src/components/QrScannerButton';
import RegisterPageLink from 'src/components/RegisterPageLink';
import ToggleThemeOption from 'src/components/ToggleThemeOption';
import { useIsBreakpointActive } from 'src/hooks/useBreakpoint';
import LazyModal, { useModal } from 'src/components/LazyModal';
import { updatePlantLastEventTimes } from './overviewSlice';
import { FaHome, FaUser } from "react-icons/fa";
import { FaPrint, FaClockRotateLeft } from "react-icons/fa6";
import clsx from 'clsx';
import { useEditableNodeListController } from 'src/components/editableNodeListController';

// Render correct components for current state objects
const Layout = () => {
    const dispatch = useDispatch();

    const plants = useSelector((state) => state.overview.plants);
    const groups = useSelector((state) => state.overview.groups);
    const archivedOverview = useSelector((state) => state.overview.archivedOverview);
    const showArchive = useSelector((state) => state.overview.showArchive);
    const pageTitle = useSelector((state) => state.overview.title);

    // Determines if 2-column layout or single centered column
    const hasPlants = Object.keys(plants).length > 0;
    const hasGroups = Object.keys(groups).length > 0;
    const twoColumns = hasPlants && hasGroups;

    // True if desktop layout, false if mobile
    const desktop = useIsBreakpointActive('md');
    // True if mobile layout with stacked plant and group columns
    // False if desktop layout (side by side columns) or only one column
    const stackedColumns = !desktop && twoColumns;

    // Refs used to jump to top of plant and group columns
    const plantsColRef = useRef(null);
    const groupsColRef = useRef(null);

    // Controllers for PlantsCol and GroupsCol, used to read user selection
    const selectedPlantsController = useEditableNodeListController();
    const selectedGroupsController = useEditableNodeListController();

    // States to control edit and add events modes (shows checkboxes when true)
    // Renders EditModeFooter and AddEventsFooter respectively when true
    const [editing, setEditing] = useState(false);
    const [addingEvents, setAddingEvents] = useState(false);

    const toggleEditing = useCallback(() => {
        setEditing(!editing);
        setAddingEvents(false);
        hideToast();
        document.activeElement.blur();
    }, [editing]);

    const toggleAddingEvents = useCallback(() => {
        setAddingEvents(!addingEvents);
        setEditing(false);
        hideToast();
        document.activeElement.blur();
    }, [addingEvents]);

    const stopAddingEvents = useCallback(() => {
        setAddingEvents(false);
    }, []);

    // Handler for AddEventsFooter buttons
    const handleAddEvents = useCallback((payload) => {
        dispatch(updatePlantLastEventTimes(payload));
    }, [dispatch]);

    // Get ref for PrintModal, create callback that opens + closes dropdown
    const printModal = useModal();
    const openPrintModal = useCallback(() => {
        printModal.open();
        document.activeElement.blur();
    }, [printModal.open]);

    // Top left corner dropdown options
    const DropdownMenuOptions = useMemo(() => {
        return (
            <>
                {/* Main overview: Link to archive overview if it exists */}
                {(!archivedOverview && showArchive) && (
                    <li><Link to='/archived' discover="none">
                        <FaClockRotateLeft className="size-4 mr-2" />
                        Archived plants
                    </Link></li>
                )}
                {/* Archive overview: Link back to main overview */}
                {archivedOverview && (
                    <li><Link to='/' discover="none">
                        <FaHome className="size-4 mr-2" />
                        Main overview
                    </Link></li>
                )}
                {/* Link to user profile unless accounts disabled */}
                {globalThis.USER_ACCOUNTS_ENABLED && (
                    <li><Link to='/accounts/profile/' discover="none">
                        <FaUser className="size-4 mr-2" />
                        User profile
                    </Link></li>
                )}
                {/* Main overview: Show Print QR Codes option */}
                {!archivedOverview && (
                    <li><a onClick={openPrintModal}>
                        <FaPrint className="size-4 mr-2" />
                        Print QR Codes
                    </a></li>
                )}
                <ToggleThemeOption />

            </>
        );
    }, [ToggleThemeOption, showArchive, openPrintModal]);

    // Dropdown with links to jump to plant or group columns
    // Only rendered on mobile layout (both columns always visible on desktop)
    const TitleQuickNavigation = useMemo(() => {
        const jumpTo = (ref) => {
            ref.current.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
            document.activeElement.blur();
        };
        const jumpToPlants = () => jumpTo(plantsColRef);
        const jumpToGroups = () => jumpTo(groupsColRef);

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

    const topRightButton = useMemo(() => <QrScannerButton />, []);

    return (
        <div
            className="container flex flex-col items-center mx-auto pb-28"
            data-testid="overview-layout"
        >
            <Navbar
                menuOptions={DropdownMenuOptions}
                title={pageTitle}
                titleOptions={stackedColumns ? TitleQuickNavigation : null}
                topRightButton={topRightButton}
            />

            <div className={clsx(
                'grid grid-cols-1 px-4 gap-y-8',
                twoColumns && 'md:grid-cols-2 gap-x-24'
            )}>
                {/* Render plants column if 1 or more plants exist */}
                {hasPlants && (
                    <div className='scroll-mt-20' ref={plantsColRef}>
                        <PlantsCol
                            plants={plants}
                            editing={editing || addingEvents}
                            selectionController={selectedPlantsController}
                            onStartEditing={toggleAddingEvents}
                            storageKey='overviewPlantsColumn'
                            // Archived overview: Click title to enter edit mode
                            onOpenTitle={archivedOverview ? toggleEditing : null}
                            // Main overview: Show add events and edit options
                            titleOptions={archivedOverview ? null : (
                                <DropdownMenu>
                                    <li><a
                                        className="flex justify-center"
                                        onClick={toggleAddingEvents}
                                        data-testid="add_plants_option"
                                    >
                                        Add events
                                    </a></li>
                                    <li><a
                                        className="flex justify-center"
                                        onClick={toggleEditing}
                                        data-testid="edit_plants_option"
                                    >
                                        Edit plants
                                    </a></li>
                                </DropdownMenu>
                            )}
                        >
                            {!archivedOverview && (
                                <RegisterPageLink
                                    type="plant"
                                    className="mx-auto mt-4"
                                />
                            )}
                        </PlantsCol>
                    </div>
                )}
                {/* Render groups column if 1 or more groups exist */}
                {hasGroups && (
                    <div className='scroll-mt-20' ref={groupsColRef}>
                        <GroupsCol
                            groups={groups}
                            editing={editing}
                            selectionController={selectedGroupsController}
                            onStartEditing={toggleEditing}
                            storageKey='overviewGroupsColumn'
                            onOpenTitle={toggleEditing}
                        >
                            {!archivedOverview && (
                                <RegisterPageLink
                                    type="group"
                                    className="mx-auto mt-4"
                                />
                            )}
                        </GroupsCol>
                    </div>
                )}
                {/* Render setup instructions if database is empty */}
                {!hasPlants && !hasGroups && !archivedOverview && (
                    <Setup openPrintModal={openPrintModal} />
                )}
            </div>

            <EditModeFooter
                visible={editing}
                selectedPlantsController={selectedPlantsController}
                selectedGroupsController={selectedGroupsController}
                setEditing={setEditing}
                archivedOverview={archivedOverview}
            />

            {!archivedOverview &&
                <AddEventsFooter
                    visible={addingEvents}
                    onClose={stopAddingEvents}
                    selectedPlantsController={selectedPlantsController}
                    plants={plants}
                    updatePlantLastEventTimes={handleAddEvents}
                />
            }

            <LazyModal
                ref={printModal.ref}
                initialTitle="Select QR Code Size"
                ariaLabel="Print QR Codes"
                load={() => import(/* webpackChunkName: "overview_print-modal" */ "./PrintModal")}
            />
        </div>
    );
};

export default Layout;
