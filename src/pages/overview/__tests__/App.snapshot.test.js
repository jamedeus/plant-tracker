import renderer from 'react-test-renderer';
import createMockContext from 'src/testUtils/createMockContext';
import { ThemeProvider } from 'src/context/ThemeContext';
import App from '../App';
import { mockContext } from './mockContext';

describe('App', () => {
    it('matches snapshot when plants and trays exist', () => {
        // Create mock state objects
        createMockContext('plants', mockContext.plants);
        createMockContext('trays', mockContext.trays);

        // Render App, confirm matches snapshot
        const component = renderer.create(
            <ThemeProvider>
                <App />
            </ThemeProvider>
        );
        let tree = component.toJSON();
        expect(tree).toMatchSnapshot();
    });
});
