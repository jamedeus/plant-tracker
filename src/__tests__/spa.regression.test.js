import AppRoot from 'src/AppRoot';
import { routes } from 'src/routes';
import { createMemoryRouter } from 'react-router-dom';
import { render, waitFor, cleanup } from '@testing-library/react';
import mockPlantSpeciesOptionsResponse from 'src/testUtils/mockPlantSpeciesOptionsResponse';
import FakeBarcodeDetector, { mockQrCodeInViewport } from 'src/testUtils/mockBarcodeDetector';
import mockCurrentURL from 'src/testUtils/mockCurrentURL';
import mockFetchResponse from 'src/testUtils/mockFetchResponse';
import applyQrScannerMocks from 'src/testUtils/applyQrScannerMocks';
import 'jest-canvas-mock';
import { mockContext as mockPlantContext } from 'src/pages/manage_plant/__tests__/mockContext';

describe('SPA regression tests', () => {
    beforeAll(() => {
        // Mock all browser APIs used by QrScanner
        applyQrScannerMocks();
    });

    beforeEach(() => {
        // Allow fast forwarding (skip debounce)
        jest.useFakeTimers({ doNotFake: ['Date'] });
    });

    // Clean up pending timers and unmount react tree after each test
    afterEach(async () => {
        await act(async () => jest.runOnlyPendingTimers());
        jest.clearAllTimers();
        jest.useRealTimers();
        cleanup();
    });

    // Original bug: When keepContents was added to PhotoModal (don't unmount
    // when closed) it became possible for modal to persist after user navigated
    // to another plant. If user navigated to overview first this did not happen
    // (whole page unmounts), but navigating with the QR code scanner renders
    // the same page and keeps elements with unchanged props/keys. This caused
    // the pending upload count to get stuck until the user refreshed the page
    // or navigated to a non-plant page.
    it('unmounts PhotoModal when user navigates to another plant', async () => {
        // Mock fetch function to return manage_plant page state
        mockFetchResponse({
            page: 'manage_plant',
            title: 'First Plant',
            state: mockPlantContext
        });

        // Render SPA on manage_plant page
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        mockCurrentURL('https://plants.lan/manage/0640ec3b-1bed-4b15-a078-d6e7ec66be12');
        const router = createMemoryRouter(routes, { initialEntries: [
            '/manage/0640ec3b-1bed-4b15-a078-d6e7ec66be12'
        ] });
        const { getByText, queryByText, getByTitle, getByTestId, queryByTestId } = render(
            <AppRoot router={router} />
        );
        await act(async () =>  await jest.advanceTimersByTimeAsync(100));
        expect(document.title).toBe('First Plant');

        // Mock expected /add_plant_photos response when 1 photo is uploaded
        mockFetchResponse({
            uploaded: "1 photo(s)",
            failed: [],
            urls: [
                {
                    timestamp: "2024-03-01T20:52:03+00:00",
                    image: "/media/images/photo1.jpg",
                    thumbnail: null,
                    preview: null,
                    key: 12,
                    pending: true
                }
            ]
        });

        // Simulate user opening photo modal and selecting 1 file
        await user.click(getByText('Add photos'));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        const fileInput = getByTestId('photo-input');
        fireEvent.change(fileInput, { target: { files: [
            new File(['file1'], 'file1.jpg', { type: 'image/jpeg' })
        ] } });
        await act(async () => await jest.advanceTimersByTimeAsync(100));

        // Confirm photo modal shows number of pending uploads
        expect(getByText('Uploading 1 photo...')).not.toBeNull();

        // Simulate user navigating to another plant by scanning QR code
        // Mock barcode-detector to simulate detecting QR code of a different plant
        mockQrCodeInViewport('https://plants.lan/manage/5c256d96ec7d408a83c73f86d63968b2');

        // Click button to open scanner, confirm scanner appeared
        await user.click(getByTitle('Open QR scanner'));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(getByTestId('qr-scanner-overlay')).toBeInTheDocument();

        // Fast forward to detect QR code, confirm link to scanned URL appears
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        await waitFor(() =>
            expect(FakeBarcodeDetector.prototype.detect).toHaveBeenCalled()
        );
        expect(getByTestId('scanned-url')).toBeInTheDocument();
        expect(getByTestId('scanned-url')).toHaveAttribute(
            'href',
            '/manage/5c256d96ec7d408a83c73f86d63968b2'
        );

        // Mock fetch function to return manage_plant  state with scanned UUID
        mockFetchResponse({
            page: 'manage_plant',
            title: 'New Plant',
            state: {
                ...mockPlantContext, plant_details: {
                    ...mockPlantContext.plant_details,
                    uuid: '5c256d96ec7d408a83c73f86d63968b2'
                }
            }
        });

        // Click link to scanned URL
        await user.click(getByTestId('scanned-url'));
        await act(async () =>  await jest.advanceTimersByTimeAsync(100));

        // Confirm closed scanner, title changed, fetched state
        expect(queryByTestId('qr-scanner-overlay')).toBeNull();
        expect(document.title).toBe('New Plant');
        expect(global.fetch).toHaveBeenCalledWith(
            '/get_manage_state/5c256d96ec7d408a83c73f86d63968b2',
            {headers: {Accept: "application/json"}}
        );

        // Open PhotoModa, confirm does NOT show pending uploads for other plant
        await user.click(getByText('Add photos'));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(queryByText('Uploading 1 photo...')).toBeNull();
    });

    // Original bug: When keepContents was added to DivisionModal (don't unmount
    // when closed) it became possible for modal to persist after user navigated
    // to another plant. If user navigated to overview first this did not happen
    // (whole page unmounts), but navigating with the QR code scanner renders
    // the same page and keeps elements with unchanged props/keys. This caused
    // the modal to still show the registration form (DivisionEvent already
    // created) after navigating to another plant.
    it('unmounts DivisionModal when user navigates to another plant', async () => {
        // Mock fetch function to return manage_plant page state
        mockFetchResponse({
            page: 'manage_plant',
            title: 'First Plant',
            state: mockPlantContext
        });

        // Render SPA on manage_plant page
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        mockCurrentURL('https://plants.lan/manage/0640ec3b-1bed-4b15-a078-d6e7ec66be12');
        const router = createMemoryRouter(routes, { initialEntries: [
            '/manage/0640ec3b-1bed-4b15-a078-d6e7ec66be12'
        ] });
        const { getByText, queryByText, getByTitle, getByRole, getByTestId, queryByTestId } = render(
            <AppRoot router={router} />
        );
        await act(async () =>  await jest.advanceTimersByTimeAsync(100));
        expect(document.title).toBe('First Plant');

        // Open DivisionModal, wait until modal renders
        await user.click(getByText('Divide plant'));
        await waitFor(() => {
            expect(queryByText('When did you divide your plant?')).not.toBeNull();
        });

        // Mock fetch function to return expected /divide_plant response
        mockFetchResponse({
            plant_key: 'divided-parent-key',
            division_event_key: 'division-event-key',
            action: 'divide',
            plant: mockPlantContext.plant_details.uuid
        });

        // Simulate user creating DivisionEvent
        await user.click(getByRole('button', { name: 'Start Dividing' }));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(global.fetch).toHaveBeenCalled();

        // Confirm division event appeared in timeline (but no children yet)
        expect(queryByText('Divided')).not.toBeNull();
        expect(queryByText('Divided into:')).toBeNull();

        // Mock /get_plant_species_options response (requested when form loads)
        // Simulate user clicking "Add QR code later" button to load form
        mockPlantSpeciesOptionsResponse();
        await user.click(getByRole('button', { name: 'Add QR code later' }));

        // Mock fetch function to return expected response when plant registered
        mockFetchResponse({
            success: 'plant registered',
            name: 'Baby plant',
            uuid: 'cc3fcb4f-120a-4577-ac87-ac6b5bea8968'
        });

        // Simulate user submitting form, confirm success screen appears
        await user.click(getByRole('button', { name: 'Register New Plant' }));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(getByText('1st plant registered!')).toBeInTheDocument();

        // Confirm child plant appeared in timeline
        expect(queryByText('Divided into:')).not.toBeNull();
        expect(getByText('Baby plant')).toBeInTheDocument();
        expect(getByText('Baby plant')).toHaveAttribute(
            'href',
            '/manage/cc3fcb4f-120a-4577-ac87-ac6b5bea8968'
        );

        // Mock fetch function to return manage_plant page state for child plant
        mockFetchResponse({
            page: 'manage_plant',
            title: 'Baby plant',
            state: {
                ...mockPlantContext,
                plant_details: {
                    ...mockPlantContext.plant_details,
                    display_name: "Baby plant",
                    uuid: "cc3fcb4f-120a-4577-ac87-ac6b5bea8968"
                },
                divided_from: {
                    name: "Test Plant",
                    uuid: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                    timestamp: "2024-02-11T04:19:23+00:00"
                }
            }
        });
        // Mock current URL to division event marker destination (clicking link
        // will update react-router history but not window.location in tests)
        mockCurrentURL(`https://plants.lan/manage/cc3fcb4f-120a-4577-ac87-ac6b5bea8968?scrollToDate=2024-02-10`);

        // Simulate user navigating to child plant by clicking link
        await user.click(getByText('Baby plant'));
        await act(async () => await jest.advanceTimersByTimeAsync(100));

        // Confirm title changed, fetched child plant state
        expect(document.title).toBe('Baby plant');
        expect(global.fetch).toHaveBeenCalledWith(
            '/get_manage_state/cc3fcb4f-120a-4577-ac87-ac6b5bea8968',
            {headers: {Accept: "application/json"}}
        );

        // Open DivisionModal, confirm first screen appears (not registration)
        await user.click(getByText('Divide plant'));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        await waitFor(() => {
            expect(queryByText('When did you divide your plant?')).not.toBeNull();
        });
        // Confirm registration form not rendered
        expect(queryByText('Register with QR code')).toBeNull();
    });
});
