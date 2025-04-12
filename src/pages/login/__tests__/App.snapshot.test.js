import { PageWrapper } from 'src/index';
import App from '../App';

describe('App', () => {
    it('matches snapshot', () => {
        // Render App, confirm matches snapshot
        const component = render(
            <PageWrapper>
                <App />
            </PageWrapper>
        );
        expect(component).toMatchSnapshot();
    });
});
