import createMockContext from 'src/testUtils/createMockContext';
import { ThemeProvider } from 'src/context/ThemeContext';
import { ErrorModalProvider } from 'src/context/ErrorModalContext';
import App from '../App';

describe('App', () => {
    it('matches snapshot when no models exist (setup)', () => {
        // Create mock state objects
        createMockContext('plants', []);
        createMockContext('trays', []);

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
