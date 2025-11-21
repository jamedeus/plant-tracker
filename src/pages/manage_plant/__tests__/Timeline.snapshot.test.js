import mockCurrentURL from 'src/testUtils/mockCurrentURL';
import Timeline from '../Timeline';
import { ReduxProvider } from '../store';
import { Toast } from 'src/components/Toast';
import { ErrorModal } from 'src/components/ErrorModal';
import { mockContext, mockEvents, mockphotos, mockContextNoEvents } from './mockContext';

describe('Timeline', () => {
    const initialState = {
        ...mockContext, events: mockEvents, photos: mockphotos
    };

    beforeAll(() => {
        globalThis.USER_ACCOUNTS_ENABLED = true;
    });

    it('matches snapshot when plant is not archived', () => {
        // Mock window.location (querystring parsed when page loads)
        mockCurrentURL('https://plants.lan/manage/e1393cfd-0133-443a-97b1-06bb5bd3fcca');

        // Render Timeline with mock context, confirm matches snapshot
        const { container } = render(
            <>
                <ReduxProvider initialState={initialState}>
                    <Timeline />
                </ReduxProvider>
                <Toast />
                <ErrorModal />
            </>
        );
        expect(container).toMatchSnapshot();
    });

    it('matches snapshot when plant is archived', () => {
        // Render Timeline with mock context containing archived=true, confirm
        // matches snapshot
        const { container } = render(
            <>
                <ReduxProvider initialState={{
                    ...initialState, plant_details: {
                        ...mockContext.plant_details,
                        archived: true
                    }
                }}>
                    <Timeline />
                </ReduxProvider>
                <Toast />
                <ErrorModal />
            </>
        );
        expect(container).toMatchSnapshot();
    });

    it('matches snapshot when plant was divided from parent', () => {
        // Render Timeline with mock context containing divided_from (set to
        // another plant), confirm matches snapshot
        const { container } = render(
            <>
                <ReduxProvider initialState={{
                    ...mockContextNoEvents,
                    divided_from: {
                        name: "Parent plant",
                        uuid: "cc3fcb4f-120a-4577-ac87-ac6b5bea8968",
                        timestamp: "2024-02-11T04:19:23+00:00"
                    }
                }}>
                    <Timeline />
                </ReduxProvider>
                <Toast />
                <ErrorModal />
            </>
        );
        expect(container).toMatchSnapshot();
    });

    it('matches snapshot when plant has divided children', () => {
        // Render Timeline with mock context containing division_event that
        // created 2 child plants, confirm matches snapshot
        const { container } = render(
            <>
                <ReduxProvider initialState={{
                    ...mockContextNoEvents,
                    division_events: {
                        "2024-02-11T04:19:23+00:00": [
                            {
                                name: "Child plant 1",
                                uuid: "cc3fcb4f-120a-4577-ac87-ac6b5bea8968"
                            },
                            {
                                name: "Child plant 2",
                                uuid: "dfafcb4d-1bed-4b15-a078-d6e7ec66be14"
                            },
                        ]
                    }
                }}>
                    <Timeline />
                </ReduxProvider>
                <Toast />
                <ErrorModal />
            </>
        );
        expect(container).toMatchSnapshot();
    });

    it('matches snapshot when plant has DivisionEvent with no children', () => {
        // Render Timeline with mock context containing division_event that
        // created 0 child plants (user used division instead of prune)
        const { container } = render(
            <>
                <ReduxProvider initialState={{
                    ...mockContextNoEvents,
                    division_events: {
                        "2024-02-11T04:19:23+00:00": []
                    }
                }}>
                    <Timeline />
                </ReduxProvider>
                <Toast />
                <ErrorModal />
            </>
        );
        expect(container).toMatchSnapshot();
    });

    it('matches snapshot when plant has details changed event', () => {
        // Render Timeline with mock context containing 3 details_changed
        // events (one where nothing changed), confirm matches snapshot
        const { container } = render(
            <>
                <ReduxProvider initialState={{
                    ...mockContextNoEvents,
                    change_events: {
                        "2024-01-05T04:19:23+00:00": {
                            name_before: null,
                            name_after: "Test plant",
                            species_before: null,
                            species_after: "Calathea",
                            description_before: null,
                            description_after: "Pretty healthy",
                            pot_size_before: null,
                            pot_size_after: 4
                        },
                        "2024-01-07T04:19:23+00:00": {
                            name_before: "Test plant",
                            name_after: "Test plant",
                            species_before: "Calathea",
                            species_after: "Calathea",
                            description_before: "Pretty healthy",
                            description_after: "Pretty healthy",
                            pot_size_before: 4,
                            pot_size_after: 4
                        },
                        "2024-03-14T04:19:23+00:00": {
                            name_before: "Test plant",
                            name_after: "Real name",
                            species_before: "Calathea",
                            species_after: null,
                            description_before: "Pretty healthy",
                            description_after: null,
                            pot_size_before: 4,
                            pot_size_after: 4
                        }
                    }
                }}>
                    <Timeline />
                </ReduxProvider>
                <Toast />
                <ErrorModal />
            </>
        );
        expect(container).toMatchSnapshot();
    });
});
