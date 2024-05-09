import renderer from 'react-test-renderer';
import Timeline from '../Timeline';
import { ErrorModalProvider } from 'src/context/ErrorModalContext';
import { mockEvents, mockPhotoUrls, mockNotes } from './mockContext';

describe('App', () => {
    it('matches snapshot', () => {
        // Render Timeline, confirm matches snapshot
        const component = renderer.create(
            <ErrorModalProvider>
                <Timeline
                    events={mockEvents}
                    notes={mockNotes}
                    photoUrls={mockPhotoUrls}
                />
            </ErrorModalProvider>
        );
        let tree = component.toJSON();
        expect(tree).toMatchSnapshot();
    });
});
