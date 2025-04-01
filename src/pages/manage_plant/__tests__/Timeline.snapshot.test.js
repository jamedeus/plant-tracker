import createMockContext from 'src/testUtils/createMockContext';
import Timeline from '../Timeline';
import { ReduxProvider } from '../store';
import { PageWrapper } from 'src/index';
import { mockContext, mockEvents, mockPhotoUrls } from './mockContext';

describe('Timeline', () => {
    beforeAll(() => {
        // Create mock state object
        createMockContext('events', mockEvents);
        createMockContext('notes', mockContext.notes);
        createMockContext('photo_urls', mockPhotoUrls);
    });

    it('matches snapshot when plant is not archived', () => {
        // Render Timeline with archived=false, confirm matches snapshot
        const component = render(
            <PageWrapper>
                <ReduxProvider>
                    <Timeline
                        plantID='0640ec3b-1bed-4b15-a078-d6e7ec66be12'
                        archived={false}
                    />
                </ReduxProvider>
            </PageWrapper>
        );
        expect(component).toMatchSnapshot();
    });

    it('matches snapshot when plant is archived', () => {
        // Render Timeline with archived=true, confirm matches snapshot
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
