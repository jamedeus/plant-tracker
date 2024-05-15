import createMockContext from 'src/testUtils/createMockContext';
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
        const component = render(
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
        expect(component).toMatchSnapshot();
    });
});
