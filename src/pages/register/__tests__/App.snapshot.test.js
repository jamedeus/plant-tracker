import renderer from 'react-test-renderer';
import createMockContext from 'src/testUtils/createMockContext';
import { ThemeProvider } from 'src/context/ThemeContext';
import { ErrorModalProvider } from 'src/context/ErrorModalContext';
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
            <ThemeProvider>
                <ErrorModalProvider>
                    <App />
                </ErrorModalProvider>
            </ThemeProvider>
        );
        let tree = component.toJSON();
        expect(tree).toMatchSnapshot();
    });
});
