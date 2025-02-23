import createMockContext from 'src/testUtils/createMockContext';
import removeMockContext from 'src/testUtils/removeMockContext';
import App from '../App';
import { PageWrapper } from 'src/index';
import { mockContext } from './mockContext';

describe('App', () => {
    // Delete mock contexts after each test (isolation)
    afterEach(() => {
        removeMockContext('plant');
        removeMockContext('notes');
        removeMockContext('group_options');
        removeMockContext('species_options');
        removeMockContext('photo_urls');
    });

    it('matches snapshot', () => {
        // Create mock state objects
        createMockContext('plant', mockContext.plant);
        createMockContext('notes', mockContext.notes);
        createMockContext('group_options', mockContext.group_options);
        createMockContext('species_options', mockContext.species_options);
        createMockContext('photo_urls', mockContext.photo_urls);

        // Render App, confirm matches snapshot
        const component = render(
            <PageWrapper>
                <App />
            </PageWrapper>
        );
        expect(component).toMatchSnapshot();
    });

    it('matches snapshot when plant is archived', () => {
        // Set plant.archived to true
        const plant = { ...mockContext.plant, archived: true };

        // Create mock state objects
        createMockContext('plant', plant);
        createMockContext('notes', mockContext.notes);
        createMockContext('group_options', mockContext.group_options);
        createMockContext('species_options', mockContext.species_options);
        createMockContext('photo_urls', mockContext.photo_urls);

        // Render App, confirm matches snapshot
        const component = render(
            <PageWrapper>
                <App />
            </PageWrapper>
        );
        expect(component).toMatchSnapshot();
    });
});
