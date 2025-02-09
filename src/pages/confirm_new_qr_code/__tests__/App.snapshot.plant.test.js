import createMockContext from 'src/testUtils/createMockContext';
import App from '../App';
import { ToastProvider } from 'src/context/ToastContext';
import { ThemeProvider } from 'src/context/ThemeContext';
import { ErrorModalProvider } from 'src/context/ErrorModalContext';
import { mockContext } from './mockContext';

describe('App', () => {
    it('matches snapshot', () => {
        // Create mock state objects
        createMockContext('type', 'plant');
        createMockContext('instance', mockContext.plant);
        createMockContext('new_uuid', mockContext.new_uuid);

        // Render App, confirm matches snapshot
        const component = render(
            <ThemeProvider>
                <ToastProvider>
                    <ErrorModalProvider>
                        <App />
                    </ErrorModalProvider>
                </ToastProvider>
            </ThemeProvider>
        );
        expect(component).toMatchSnapshot();
    });
});
