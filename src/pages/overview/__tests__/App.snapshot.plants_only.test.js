import renderer from 'react-test-renderer';
import createMockContext from 'src/testUtils/createMockContext';
import { ThemeProvider } from 'src/context/ThemeContext';
import { ErrorModalProvider } from 'src/context/ErrorModalContext';
import App from '../App';
import { mockContext } from './mockContext';

describe('App', () => {
    it('matches snapshot when only plants exist', () => {
        // Create mock state objects
        createMockContext('plants', mockContext.plants);
        createMockContext('trays', []);

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
