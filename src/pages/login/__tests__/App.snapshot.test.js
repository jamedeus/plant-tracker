import App from '../App';

describe('App', () => {
    it('matches snapshot', () => {
        // Render App, confirm matches snapshot
        const component = render(<App />);
        expect(component).toMatchSnapshot();
    });
});
