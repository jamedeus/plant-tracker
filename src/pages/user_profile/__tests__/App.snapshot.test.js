import App from '../App';

describe('App', () => {
    it('matches snapshot', () => {
        // Render App, confirm matches snapshot
        globalThis.USER_ACCOUNTS_ENABLED = true;
        const { container } = render(<App initialState={{
            user_details: {
                username: "cdanger",
                email: "totally.not.anthony.weiner@gmail.com",
                first_name: "Carlos",
                last_name: "Danger",
                date_joined: "2025-04-06T00:08:53.392806+00:00",
                email_verified: false
            }
        }} />);
        expect(container).toMatchSnapshot();
    });
});
