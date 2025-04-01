import createMockContext from 'src/testUtils/createMockContext';
import removeMockContext from 'src/testUtils/removeMockContext';
import App from '../App';
import { TimelineProvider } from '../TimelineContext';
import { PageWrapper } from 'src/index';
import { mockContext } from './mockContext';

describe('App', () => {
    // Delete mock contexts after each test (isolation)
    afterEach(() => {
        removeMockContext('plant_details');
        removeMockContext('events');
        removeMockContext('notes');
        removeMockContext('group_options');
        removeMockContext('species_options');
        removeMockContext('photo_urls');
    });

    it('matches snapshot', () => {
        // Create mock state objects
        createMockContext('plant_details', mockContext.plant_details);
        createMockContext('events', mockContext.events);
        createMockContext('notes', mockContext.notes);
        createMockContext('group_options', mockContext.group_options);
        createMockContext('species_options', mockContext.species_options);
        createMockContext('photo_urls', mockContext.photo_urls);

        // Render App, confirm matches snapshot
        const component = render(
            <PageWrapper>
                <TimelineProvider>
                    <App />
                </TimelineProvider>
            </PageWrapper>
        );
        expect(component).toMatchSnapshot();
    });

    it('matches snapshot when plant is archived', () => {
        // Set plant_details.archived to true
        const plant_details = { ...mockContext.plant_details, archived: true };

        // Create mock state objects
        createMockContext('plant_details', plant_details);
        createMockContext('events', mockContext.events);
        createMockContext('notes', mockContext.notes);
        createMockContext('group_options', mockContext.group_options);
        createMockContext('species_options', mockContext.species_options);
        createMockContext('photo_urls', mockContext.photo_urls);

        // Render App, confirm matches snapshot
        const component = render(
            <PageWrapper>
                <TimelineProvider>
                    <App />
                </TimelineProvider>
            </PageWrapper>
        );
        expect(component).toMatchSnapshot();
    });
});
