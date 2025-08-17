// Takes URL, mocks window.location
const mockCurrentURL = (url) => {
    const urlObj = new URL(url);
    Object.defineProperty(window, 'location', {
        configurable: true,
        value: {
            ...window.location,
            href: urlObj.href,
            origin: urlObj.origin,
            host: urlObj.host,
            hostname: urlObj.hostname,
            port: urlObj.port,
            protocol: urlObj.protocol,
            pathname: urlObj.pathname,
            search: urlObj.search,
            hash: urlObj.hash,
            assign: jest.fn(),
            replace: jest.fn(),
            reload: jest.fn(),
        },
    });
};

export default mockCurrentURL;
