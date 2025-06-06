import createMockContext from 'src/testUtils/createMockContext';
import bulkCreateMockContext from 'src/testUtils/bulkCreateMockContext';
import Timeline from '../Timeline';
import { ReduxProvider } from '../store';
import { PageWrapper } from 'src/index';
import { mockContext, mockEvents, mockphotos } from './mockContext';

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
});
