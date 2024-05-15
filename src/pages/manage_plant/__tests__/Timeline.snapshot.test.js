import createMockContext from 'src/testUtils/createMockContext';
import renderer from 'react-test-renderer';
import Timeline from '../Timeline';
import { NoteModalProvider } from '../NoteModal';
import { ToastProvider } from 'src/context/ToastContext';
import { ErrorModalProvider } from 'src/context/ErrorModalContext';
import { mockContext, mockEvents, mockPhotoUrls } from './mockContext';

describe('App', () => {
    it('matches snapshot', () => {
        // Create mock state object
        createMockContext('notes', mockContext.notes);

        // Render Timeline, confirm matches snapshot
        const component = renderer.create(
            <ErrorModalProvider>
                <ToastProvider>
                    <NoteModalProvider>
                        <Timeline
                            plantID={"0640ec3b-1bed-4b15-a078-d6e7ec66be12"}
                            events={mockEvents}
                            photoUrls={mockPhotoUrls}
                        />
                    </NoteModalProvider>
                </ToastProvider>
            </ErrorModalProvider>
        );
        let tree = component.toJSON();
        expect(tree).toMatchSnapshot();
    });
});
