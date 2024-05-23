import createMockContext from 'src/testUtils/createMockContext';
import { ThemeProvider } from 'src/context/ThemeContext';
import { ErrorModalProvider } from 'src/context/ErrorModalContext';
import App from '../App';
import { mockContext } from './mockContext';

describe('App', () => {
    it('matches snapshot when only plants exist', () => {
        // Create mock state objects
        createMockContext('plants', mockContext.plants);
        createMockContext('groups', []);

        // Render App, confirm matches snapshot
        const component = render(
            <ThemeProvider>
                <ErrorModalProvider>
                    <App />
                </ErrorModalProvider>
            </ThemeProvider>
        );
        expect(component).toMatchSnapshot();
    });
});
