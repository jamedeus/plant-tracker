import React, { act } from 'react';
import { postHeaders } from 'src/testUtils/headers';
import mockCurrentURL from 'src/testUtils/mockCurrentURL';
import mockFetchResponse from 'src/testUtils/mockFetchResponse';
import mockPlantSpeciesOptionsResponse from 'src/testUtils/mockPlantSpeciesOptionsResponse';
import { v4 as mockUuidv4 } from 'uuid';
import DivisionModal from '../DivisionModal';
import { ReduxProvider } from '../store';
import { ErrorModal } from 'src/components/ErrorModal';
import { mockContext } from './mockContext';
import applyQrScannerMocks from 'src/testUtils/applyQrScannerMocks';
import FakeBarcodeDetector, { mockQrCodeInViewport } from 'src/testUtils/mockBarcodeDetector';
import 'jest-canvas-mock';

jest.mock('uuid', () => ({
    v4: jest.fn(),
}));

describe('DivisionModal', () => {
    let app, user;
    const mockClose = jest.fn();

    beforeEach(() => {
        // Allow fast forwarding
        jest.useFakeTimers({ doNotFake: ['Date'] });

        mockUuidv4.mockReset();

        // Render app + create userEvent instance to use in tests
        user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        app = render(
            <>
                <ReduxProvider initialState={mockContext}>
                    <DivisionModal close={mockClose} />
                </ReduxProvider>
                <ErrorModal />
            </>
        );
    });

    // Clean up pending timers after each test
    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
        mockClose.mockClear();
    });

    it('sends correct payload when DivisionEvent is created', async () => {
        // Mock fetch function to return expected /divide_plant response
        mockFetchResponse({
            plant_key: 'divided-parent-key',
            division_event_key: 'division-event-key',
            action: 'divide',
            plant: mockContext.plant_details.uuid
        });

        // Confirm instructions are visible, register child buttons are not
        expect(app.getByText(/Dividing a plant lets you register new plants/)).toBeInTheDocument();
        expect(app.queryByText('Register with QR code')).toBeNull();
        expect(app.queryByText('Add QR code later')).toBeNull();

        // Simulate user creating DivisionEvent
        await user.click(app.getByRole('button', { name: 'Start Dividing' }));
        await act(async () => await jest.advanceTimersByTimeAsync(100));

        // Confirm correct data posted to /divide_plant endpoint
        expect(global.fetch).toHaveBeenCalledWith('/divide_plant', {
            method: 'POST',
            body: JSON.stringify({
                plant_id: mockContext.plant_details.uuid,
                timestamp: '2024-03-01T20:00:00.000Z'
            }),
            headers: postHeaders
        });

        // Confirm instructions disappeared, register child buttons appeared
        expect(app.queryByText(/Dividing a plant lets you register new plants/)).toBeNull();
        expect(app.getByRole('button', { name: 'Register with QR code' })).toBeInTheDocument();
        expect(app.getByRole('button', { name: 'Add QR code later' })).toBeInTheDocument();
    });

    it('sends correct payload when child plant is registered', async () => {
        // Mock fetch function to return expected /divide_plant response
        mockFetchResponse({
            plant_key: 'parent-key-1',
            division_event_key: 'division-event-1',
            action: 'divide',
            plant: mockContext.plant_details.uuid
        });
        // Mock uuidv4 to return a predictable string
        mockUuidv4.mockReturnValue('child-uuid-1');

        // Simulate user creating DivisionEvent, confirm next screen loaded
        await user.click(app.getByRole('button', { name: 'Start Dividing' }));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(global.fetch).toHaveBeenCalled();
        expect(app.getByText('Register with QR code')).toBeInTheDocument();

        // Mock /get_plant_species_options response (requested when form loads)
        mockPlantSpeciesOptionsResponse();

        // Simulate user clicking "Add QR code later" button, confirm form appears
        await user.click(app.getByRole('button', { name: 'Add QR code later' }));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(app.getByTestId('division-modal-form')).toBeInTheDocument();

        // Mock fetch function to return expected response when plant registered
        mockFetchResponse({success: 'plant registered'});

        // Simulate user submitting form, confirm success screen appears
        await user.click(app.getByRole('button', { name: 'Register New Plant' }));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(app.getByText('1st plant registered!')).toBeInTheDocument();

        // Confirm correct data posted to /register_plant endpoint (including
        // divided_from_id and divided_from_event_id so ForeignKey created)
        expect(global.fetch).toHaveBeenCalledWith('/register_plant', {
            method: 'POST',
            body: JSON.stringify({
                uuid: 'child-uuid-1',
                name: 'Test Plant prop',
                species: 'Calathea',
                pot_size: '4',
                description: 'Divided from Test Plant on March 1, 2024',
                divided_from_id: 'parent-key-1',
                divided_from_event_id: 'division-event-1'
            }),
            headers: postHeaders
        });
    });

    it('shows number of child plants registered each time success screen shown', async () => {
        // Mock fetch function to return expected /divide_plant response
        mockFetchResponse({
            plant_key: 'parent-key-1',
            division_event_key: 'division-event-1',
            action: 'divide',
            plant: mockContext.plant_details.uuid
        });
        // Mock uuidv4 to return a predictable string
        mockUuidv4.mockReturnValue('child-uuid-1');

        // Simulate user creating DivisionEvent, confirm next screen loaded
        await user.click(app.getByRole('button', { name: 'Start Dividing' }));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(global.fetch).toHaveBeenCalled();
        expect(app.getByText('Register with QR code')).toBeInTheDocument();

        // Mock /get_plant_species_options response (requested when form loads)
        mockPlantSpeciesOptionsResponse();

        // Simulate user clicking "Add QR code later" button, confirm form appears
        await user.click(app.getByRole('button', { name: 'Add QR code later' }));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(app.getByTestId('division-modal-form')).toBeInTheDocument();

        // Mock fetch function to return expected response when plant registered
        mockFetchResponse({success: 'plant registered'});

        // Simulate user submitting form, confirm success screen appears
        await user.click(app.getByRole('button', { name: 'Register New Plant' }));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(app.getByText('1st plant registered!')).toBeInTheDocument();

        // Confirm payload includes 1st child plant mock UUID
        expect(global.fetch).toHaveBeenCalledWith('/register_plant', {
            method: 'POST',
            body: JSON.stringify({
                uuid: 'child-uuid-1',
                name: 'Test Plant prop',
                species: 'Calathea',
                pot_size: '4',
                description: 'Divided from Test Plant on March 1, 2024',
                divided_from_id: 'parent-key-1',
                divided_from_event_id: 'division-event-1'
            }),
            headers: postHeaders
        });

        // Simulate clicking button to register aother child plant
        mockPlantSpeciesOptionsResponse();
        mockUuidv4.mockReturnValue('child-uuid-2');
        await user.click(app.getByRole('button', { name: 'Register without QR code' }));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(app.getByTestId('division-modal-form')).toBeInTheDocument();

        // Mock fetch function to return expected response when plant registered
        mockFetchResponse({success: 'plant registered'});

        // Simulate user submitting form, confirm success screen appears
        await user.click(app.getByRole('button', { name: 'Register New Plant' }));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        // Confirm number of registered plants updated
        expect(app.getByText('2nd plant registered!')).toBeInTheDocument();

        // Confirm payload includes 2nd child plant mock UUID
        expect(global.fetch).toHaveBeenCalledWith('/register_plant', {
            method: 'POST',
            body: JSON.stringify({
                uuid: 'child-uuid-2',
                name: 'Test Plant prop',
                species: 'Calathea',
                pot_size: '4',
                description: 'Divided from Test Plant on March 1, 2024',
                divided_from_id: 'parent-key-1',
                divided_from_event_id: 'division-event-1'
            }),
            headers: postHeaders
        });

        // Simulate clicking button to register aother child plant
        mockPlantSpeciesOptionsResponse();
        mockUuidv4.mockReturnValue('child-uuid-3');
        await user.click(app.getByRole('button', { name: 'Register without QR code' }));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(app.getByTestId('division-modal-form')).toBeInTheDocument();

        // Mock fetch function to return expected response when plant registered
        mockFetchResponse({success: 'plant registered'});

        // Simulate user submitting form, confirm success screen appears
        await user.click(app.getByRole('button', { name: 'Register New Plant' }));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        // Confirm number of registered plants updated
        expect(app.getByText('3rd plant registered!')).toBeInTheDocument();

        // Confirm payload includes 3rd child plant mock UUID
        expect(global.fetch).toHaveBeenCalledWith('/register_plant', {
            method: 'POST',
            body: JSON.stringify({
                uuid: 'child-uuid-3',
                name: 'Test Plant prop',
                species: 'Calathea',
                pot_size: '4',
                description: 'Divided from Test Plant on March 1, 2024',
                divided_from_id: 'parent-key-1',
                divided_from_event_id: 'division-event-1'
            }),
            headers: postHeaders
        });
    });

    it('shows error modal if error received while dividing plant', async () => {
        // Mock error returned by /divide_plant when duplicate event exists
        mockFetchResponse({error: "Event with same timestamp already exists"}, 409);

        // Confirm error modal is not rendered
        expect(app.queryByTestId('error-modal-body')).toBeNull();

        // Simulate user clicking divide plant button
        await user.click(app.getByRole('button', { name: 'Start Dividing' }));
        await act(async () => await jest.advanceTimersByTimeAsync(100));

        // Confirm error modal appeared with mock error text
        expect(app.getByTestId('error-modal-body')).toBeInTheDocument();
        expect(app.getByTestId('error-modal-body')).toHaveTextContent(
            'Event with same timestamp already exists'
        );

        // Confirm first screen (instructions) still visible (did not proceed)
        expect(app.getByText(/Dividing a plant lets you register new plants/)).toBeInTheDocument();
    });

    it('shows error modal if error received while registering child plant', async () => {
        // Mock fetch function to return expected /divide_plant response
        mockFetchResponse({
            plant_key: 'parent-key-1',
            division_event_key: 'division-event-1',
            action: 'divide',
            plant: mockContext.plant_details.uuid
        });
        // Mock uuidv4 to return a predictable string
        mockUuidv4.mockReturnValue('child-uuid-1');

        // Simulate user creating DivisionEvent
        await user.click(app.getByRole('button', { name: 'Start Dividing' }));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(global.fetch).toHaveBeenCalled();
        expect(app.getByText('Register with QR code')).toBeInTheDocument();

        // Simulate user clicking "Add QR code later" button
        mockPlantSpeciesOptionsResponse();
        await user.click(app.getByRole('button', { name: 'Add QR code later' }));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(app.getByTestId('division-modal-form')).toBeInTheDocument();

        // Simulate /register_plant returning error response
        mockFetchResponse({error: "Failed to register plant"}, 400);

        // Simulate user submitting form
        await user.click(app.getByRole('button', { name: 'Register New Plant' }));
        await act(async () => await jest.advanceTimersByTimeAsync(100));

        // Confirm error modal appeared with mock error text
        expect(app.getByTestId('error-modal-body')).toBeInTheDocument();
        expect(app.getByTestId('error-modal-body')).toHaveTextContent(
            'Failed to register plant'
        );
    });
});

describe('DivisionModal with DivisionScanner', () => {
    let app, user;
    const mockClose = jest.fn();

    beforeAll(() => {
        // Mock all browser APIs used by QrScanner
        applyQrScannerMocks();
    });

    beforeEach(() => {
        mockCurrentURL('https://plants.lan/');

        // Allow fast forwarding
        jest.useFakeTimers({ doNotFake: ['Date'] });

        // Render app + create userEvent instance to use in tests
        user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        app = render(
            <>
                <ReduxProvider initialState={mockContext}>
                    <DivisionModal close={mockClose} />
                </ReduxProvider>
                <ErrorModal />
            </>
        );
    });

    // Clean up pending timers after each test
    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
        mockClose.mockClear();
    });

    it('uses QR scanner to capture UUID for /register_plant payload', async () => {
        // Mock fetch function to return expected /divide_plant response
        mockFetchResponse({
            plant_key: 'parent-key-1',
            division_event_key: 'division-event-1',
            action: 'divide',
            plant: mockContext.plant_details.uuid
        });

        // Simulate user creating DivisionEvent, confirm next screen loaded
        await user.click(app.getByRole('button', { name: 'Start Dividing' }));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(global.fetch).toHaveBeenCalled();
        expect(app.getByText('Register with QR code')).toBeInTheDocument();

        // Confirm qr-scanner-overlay is not visible
        expect(app.queryByTestId('qr-scanner-overlay')).toBeNull();

        // Simulate user clicking "Register with QR code" button
        await user.click(app.getByRole('button', { name: 'Register with QR code' }));

        // Confirm qr-scanner-overlay appeared
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(app.getByTestId('qr-scanner-overlay')).toBeInTheDocument();
        expect(app.getByText('Scan the QR code for your new plant')).toBeInTheDocument();
        expect(app.queryByTestId('confirm-new-qr-code-button')).toBeNull();

        // Simulate valid QR code with available UUID entering the viewport
        mockQrCodeInViewport('https://plants.lan/manage/5c256d96ec7d408a83c73f86d63968b2');
        mockFetchResponse({available: true});

        // Fast forward until QR code detected, confirm button replaces instructions
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        await waitFor(() =>
            expect(FakeBarcodeDetector.prototype.detect).toHaveBeenCalled()
        );
        expect(app.queryByText('Scan the QR code for your new plant')).toBeNull();
        expect(app.getByTestId('confirm-new-qr-code-button')).toBeInTheDocument();

        // Mock /get_plant_species_options response (requested when form loads)
        mockPlantSpeciesOptionsResponse();

        // Simulate user clicking confirm button
        await user.click(app.getByTestId('confirm-new-qr-code-button'));
        await act(async () => await jest.advanceTimersByTimeAsync(100));

        // Confirm scanner overlay closed, registration form appeared
        expect(app.queryByTestId('qr-scanner-overlay')).toBeNull();
        expect(app.getByTestId('division-modal-form')).toBeInTheDocument();

        // Mock fetch function to return expected response when plant registered
        mockFetchResponse({success: 'plant registered'});

        // Simulate user submitting form, confirm success screen appears
        await user.click(app.getByRole('button', { name: 'Register New Plant' }));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(app.getByText('1st plant registered!')).toBeInTheDocument();

        // Confirm correct data posted to /register_plant endpoint (including
        // UUID from mock QR code)
        expect(global.fetch).toHaveBeenCalledWith('/register_plant', {
            method: 'POST',
            body: JSON.stringify({
                uuid: '5c256d96ec7d408a83c73f86d63968b2',
                name: 'Test Plant prop',
                species: 'Calathea',
                pot_size: '4',
                description: 'Divided from Test Plant on March 1, 2024',
                divided_from_id: 'parent-key-1',
                divided_from_event_id: 'division-event-1'
            }),
            headers: postHeaders
        });
    });
});
