import createMockContext from 'src/testUtils/createMockContext';
import mockCurrentURL from 'src/testUtils/mockCurrentURL';
import bulkCreateMockContext from 'src/testUtils/bulkCreateMockContext';
import { mockContext, mockphotos } from './mockContext';
import { ReduxProvider } from '../store';
import { useDispatch } from 'react-redux';
import Gallery from '../Gallery';
import { photoGalleryOpened } from '../interfaceSlice';

const TestComponent = () => {
    const dispatch = useDispatch();

    return (
        <>
            <button onClick={() => dispatch(photoGalleryOpened({open: true}))}>
                Open Gallery
            </button>
            <Gallery />
        </>
    );
};

describe('Gallery', () => {
    beforeAll(() => {
        // Create mock state objects
        bulkCreateMockContext(mockContext);
        createMockContext('user_accounts_enabled', true);
        // Override photos state with mock containing more photos
        createMockContext('photos', mockphotos);
        // Mock window.location (querystring parsed when page loads)
        mockCurrentURL('https://plants.lan/manage/e1393cfd-0133-443a-97b1-06bb5bd3fcca');
    });

    it('matches snapshot for desktop layout', async () => {
        // Set width greater than tailwind md breakpoint, render gallery
        window.innerWidth = 800;
        const user = userEvent.setup();
        const { container, getByRole } = render(
            <ReduxProvider>
                <TestComponent />
            </ReduxProvider>
        );

        // Open gallery, confirm matches snapshot
        await user.click(getByRole('button', {name: 'Open Gallery'}));
        expect(container).toMatchSnapshot();
    });

    it('matches snapshot for desktop layout', async () => {
        // Set width less than tailwind md breakpoint, render gallery
        window.innerWidth = 600;
        const user = userEvent.setup();
        const { container, getByRole } = render(
            <ReduxProvider>
                <TestComponent />
            </ReduxProvider>
        );

        // Open gallery, confirm matches snapshot
        await user.click(getByRole('button', {name: 'Open Gallery'}));
        expect(container).toMatchSnapshot();
    });
});

