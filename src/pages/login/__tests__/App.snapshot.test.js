import App from '../App';

describe('App', () => {
    it('matches snapshot', () => {
        // Render App, confirm matches snapshot
        const { container } = render(<App />);
        expect(container).toMatchSnapshot();
    });
});
