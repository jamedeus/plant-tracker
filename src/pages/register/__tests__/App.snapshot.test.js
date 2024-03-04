import renderer from 'react-test-renderer';
import createMockContext from 'src/testUtils/createMockContext';
import App from '../App';
import { mockContext } from './mockContext';

describe('App', () => {
    // Setup: Create mock state objects
    beforeEach(() => {
    });

    it('matches snapshot', () => {
        // Create mock state objects
        createMockContext('new_id', mockContext.new_id);
        createMockContext('species_options', mockContext.species_options);

        // Render App, confirm matches snapshot
        const component = renderer.create(
            <App />
        );
        let tree = component.toJSON();
        expect(tree).toMatchSnapshot();
    });
});
