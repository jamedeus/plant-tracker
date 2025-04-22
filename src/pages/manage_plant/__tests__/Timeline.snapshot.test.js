import createMockContext from 'src/testUtils/createMockContext';
import Timeline from '../Timeline';
import { ReduxProvider } from '../store';
import { PageWrapper } from 'src/index';
import { mockContext, mockEvents, mockphotos } from './mockContext';

describe('Timeline', () => {
    beforeAll(() => {
        // Create mock state objects
        createMockContext('events', mockEvents);
        createMockContext('notes', mockContext.notes);
        createMockContext('photos', mockphotos);
        createMockContext('user_accounts_enabled', true);
    });

    it('matches snapshot when plant is not archived', () => {
        // Create mock plant_details context with archived=false
        createMockContext('plant_details', mockContext.plant_details);

        // Render Timeline, confirm matches snapshot
        const component = render(
            <PageWrapper>
                <ReduxProvider>
                    <Timeline />
                </ReduxProvider>
            </PageWrapper>
        );
        expect(component).toMatchSnapshot();
    });

    it('matches snapshot when plant is archived', () => {
        // Create mock plant_details context with archived=true
        createMockContext('plant_details', {
            ...mockContext.plant_details,
            archived: true
        });

        // Render Timeline, confirm matches snapshot
        const component = render(
            <PageWrapper>
                <ReduxProvider>
                    <Timeline
                        plantID='0640ec3b-1bed-4b15-a078-d6e7ec66be12'
                        archived={true}
                    />
                </ReduxProvider>
            </PageWrapper>
        );
        expect(component).toMatchSnapshot();
    });
});
