import createMockContext from 'src/testUtils/createMockContext';
import mockCurrentURL from 'src/testUtils/mockCurrentURL';
import Timeline from '../Timeline';
import { ReduxProvider } from '../store';
import { PageWrapper } from 'src/index';
import { mockContext, mockEvents, mockphotos, mockContextNoEvents } from './mockContext';

describe('Timeline', () => {
    const initialState = {
        ...mockContext, events: mockEvents, photos: mockphotos
    };

    beforeAll(() => {
        createMockContext('user_accounts_enabled', true);
    });

    it('matches snapshot when plant is not archived', () => {
        // Mock window.location (querystring parsed when page loads)
        mockCurrentURL('https://plants.lan/manage/e1393cfd-0133-443a-97b1-06bb5bd3fcca');

        // Render Timeline with mock context, confirm matches snapshot
        const { container } = render(
            <PageWrapper>
                <ReduxProvider initialState={initialState}>
                    <Timeline />
                </ReduxProvider>
            </PageWrapper>
        );
        expect(container).toMatchSnapshot();
    });

    it('matches snapshot when plant is archived', () => {
        // Render Timeline with mock context containing archived=true, confirm
        // matches snapshot
        const { container } = render(
            <PageWrapper>
                <ReduxProvider initialState={{
                    ...initialState, plant_details: {
                        ...mockContext.plant_details,
                        archived: true
                    }
                }}>
                    <Timeline
                        plantID='0640ec3b-1bed-4b15-a078-d6e7ec66be12'
                        archived={true}
                    />
                </ReduxProvider>
            </PageWrapper>
        );
        expect(container).toMatchSnapshot();
    });

    it('matches snapshot when plant was divided from parent', () => {
        // Render Timeline with mock context containing divided_from (set to
        // another plant), confirm matches snapshot
        const { container } = render(
            <PageWrapper>
                <ReduxProvider initialState={{
                    ...mockContextNoEvents,
                    divided_from: {
                        name: "Parent plant",
                        uuid: "cc3fcb4f-120a-4577-ac87-ac6b5bea8968",
                        timestamp: "2024-02-11T04:19:23+00:00"
                    }
                }}>
                    <Timeline
                        plantID='0640ec3b-1bed-4b15-a078-d6e7ec66be12'
                        archived={true}
                    />
                </ReduxProvider>
            </PageWrapper>
        );
        expect(container).toMatchSnapshot();
    });

    it('matches snapshot when plant has divided children', () => {
        // Render Timeline with mock context containing division_event that
        // created 2 child plants, confirm matches snapshot
        const { container } = render(
            <PageWrapper>
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
                                uuid: "dfafcb4d-220e-2543-f187-fb6b5be589ba"
                            },
                        ]
                    }
                }}>
                    <Timeline
                        plantID='0640ec3b-1bed-4b15-a078-d6e7ec66be12'
                        archived={true}
                    />
                </ReduxProvider>
            </PageWrapper>
        );
        expect(container).toMatchSnapshot();
    });

    it('matches snapshot when plant has DivisionEvent with no children', () => {
        // Render Timeline with mock context containing division_event that
        // created 0 child plants (user used division instead of prune)
        const { container } = render(
            <PageWrapper>
                <ReduxProvider initialState={{
                    ...mockContextNoEvents,
                    division_events: {
                        "2024-02-11T04:19:23+00:00": []
                    }
                }}>
                    <Timeline
                        plantID='0640ec3b-1bed-4b15-a078-d6e7ec66be12'
                        archived={true}
                    />
                </ReduxProvider>
            </PageWrapper>
        );
        expect(container).toMatchSnapshot();
    });
});
