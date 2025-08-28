import mockCurrentURL from 'src/testUtils/mockCurrentURL';
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
        // Simulate SINGLE_USER_MODE disabled on backend
        globalThis.USER_ACCOUNTS_ENABLED = true;
        // Mock window.location (querystring parsed when page loads)
        mockCurrentURL('https://plants.lan/manage/e1393cfd-0133-443a-97b1-06bb5bd3fcca');
    });

    it('matches snapshot for desktop layout', async () => {
        // Set width greater than tailwind md breakpoint, render gallery
        window.innerWidth = 800;
        const user = userEvent.setup();
        const { container, getByRole } = render(
            <ReduxProvider initialState={{ ...mockContext, photos: mockphotos }}>
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
            <ReduxProvider initialState={{ ...mockContext, photos: mockphotos }}>
                <TestComponent />
            </ReduxProvider>
        );

        // Open gallery, confirm matches snapshot
        await user.click(getByRole('button', {name: 'Open Gallery'}));
        expect(container).toMatchSnapshot();
    });
});

