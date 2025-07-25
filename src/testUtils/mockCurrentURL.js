// Takes URL and optional pathname, mocks window.location
const mockCurrentURL = (url, pathname) => {
    Object.defineProperty(window, 'location', {
        configurable: true,
        value: {
            ...window.location,
            href: url,
            pathname: pathname,
            origin: url.replace(pathname, ''),
            host: url.replace(pathname, '').replace('http://', '').replace('https://', '').replace(/\/$/, ''),
            assign: jest.fn()
        }
    });
};

export default mockCurrentURL;
