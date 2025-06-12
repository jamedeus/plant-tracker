import createMockContext from 'src/testUtils/createMockContext';
import bulkCreateMockContext from 'src/testUtils/bulkCreateMockContext';
import Timeline from '../Timeline';
import { ReduxProvider } from '../store';
import { PageWrapper } from 'src/index';
import { mockContext, mockEvents, mockphotos, mockContextNoEvents } from './mockContext';

describe('Timeline', () => {
    beforeAll(() => {
        // Create mock state objects
        bulkCreateMockContext(mockContext);
        // Overwrite events and photos with larger mocks (populate timeline)
        createMockContext('events', mockEvents);
        createMockContext('photos', mockphotos);
        createMockContext('user_accounts_enabled', true);
    });

    it('matches snapshot when plant is not archived', () => {
        // Render Timeline, confirm matches snapshot
        const { container } = render(
            <PageWrapper>
                <ReduxProvider>
                    <Timeline />
                </ReduxProvider>
            </PageWrapper>
        );
        expect(container).toMatchSnapshot();
    });

    it('matches snapshot when plant is archived', () => {
        // Create mock plant_details context with archived=true
        createMockContext('plant_details', {
            ...mockContext.plant_details,
            archived: true
        });

        // Render Timeline, confirm matches snapshot
        const { container } = render(
            <PageWrapper>
                <ReduxProvider>
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
        // Create mock context with divided_from set to another plant
        bulkCreateMockContext({
            ...mockContextNoEvents,
            divided_from: {
                name: "Parent plant",
                uuid: "cc3fcb4f-120a-4577-ac87-ac6b5bea8968",
                timestamp: "2024-02-11T04:19:23+00:00"
            }
        });

        // Render Timeline, confirm matches snapshot
        const { container } = render(
            <PageWrapper>
                <ReduxProvider>
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
        // Create mock context with division_events containing an event that
        // created 2 child plants
        bulkCreateMockContext({
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
        });

        // Render Timeline, confirm matches snapshot
        const { container } = render(
            <PageWrapper>
                <ReduxProvider>
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
        // Create mock context with division_events containing and event that
        // created 0 child plants (user used division instead of prune)
        bulkCreateMockContext({
            ...mockContextNoEvents,
            division_events: {
                "2024-02-11T04:19:23+00:00": []
            }
        });

        // Render Timeline, confirm matches snapshot
        const { container } = render(
            <PageWrapper>
                <ReduxProvider>
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
