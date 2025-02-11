import createMockContext from 'src/testUtils/createMockContext';
import { PageWrapper } from 'src/index';
import App from '../App';
import { mockContext } from './mockContext';

describe('App', () => {
    it('matches snapshot when plants and groups exist', () => {
        // Create mock state objects
        createMockContext('plants', mockContext.plants);
        createMockContext('groups', mockContext.groups);

        // Render App, confirm matches snapshot
        const component = render(
            <PageWrapper>
                <App />
            </PageWrapper>
        );
        expect(component).toMatchSnapshot();
    });
});

describe('App (archived page)', () => {
    it('matches snapshot when plants and groups exist', () => {
        // Create mock state objects (flip all archived bools to true)
        createMockContext('plants', mockContext.plants.map(plant => {
            plant.archived = true;
            return plant;
        }));
        createMockContext('groups', mockContext.groups.map(group => {
            group.archived = true;
            return group;
        }));

        // Mock window.location to simulate archived overview
        delete window.location;
        window.location = new URL('https://plants.lan/archived');

        // Render App, confirm matches snapshot
        const component = render(
            <PageWrapper>
                <App />
            </PageWrapper>
        );
        expect(component).toMatchSnapshot();
    });
});

