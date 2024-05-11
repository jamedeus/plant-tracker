import { useRef } from 'react';
import DatetimeInput from '../DatetimeInput';

const TestComponent = ({ value=null }) => {
    return <DatetimeInput inputRef={useRef(null)} value={value} />
}

describe('DatetimeInput', () => {
    let consoleErrorSpy;

    beforeEach(() => {
        consoleErrorSpy = jest.spyOn(console, 'error');
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it('defaults to current day when value arg is null', () => {
        // Render without passing value arg
        const component = render(<TestComponent />);

        // Confirm value matches mocked date
        expect(component.container.querySelector('.input').value).toBe('2024-03-01T12:00');
    });

    it('defaults to value arg when present', () => {
        // Render with value arg
        const component = render(<TestComponent value={'2024-04-04T00:00:00'} />);

        // Confirm value matches value arg
        expect(component.container.querySelector('.input').value).toBe('2024-04-04T00:00');
    });

    it('logs error when value arg does not match datetime regex', () => {
        // Render with invalid value arg, confirm error printed to console
        expect(consoleErrorSpy).not.toHaveBeenCalled();
        render(<DatetimeInput value={'2024-04- 00:00:00'} />);
        expect(consoleErrorSpy).toHaveBeenCalled();
    });
});
