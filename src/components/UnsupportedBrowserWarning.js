import React, { useState, useMemo, useCallback } from 'react';
import UAParser from 'ua-parser-js';
import HoldToConfirm from 'src/components/HoldToConfirm';
import clsx from 'clsx';

// Returns true if user's browser is supported, false if not supported
// Tailwind v4 minimums: Chromium >= 111, Safari >= 16.4, Firefox >= 128
function isSupportedBrowser(parsed) {
    try {
        const browserName = parsed.browser?.name;
        const browserMajor = Number(parsed.browser?.major);
        const browserVersion = parsed.browser?.version;

        // Chromium family >= 111 supported, older unsupported
        if (/Chrome|Chromium|Edge/i.test(browserName)) {
            return browserMajor >= 111;
        }

        // Firefox >= 128 supported, older unsupported
        if (/Firefox/i.test(browserName)) {
            return browserMajor >= 128;
        }

        // Safari >= 16.4 supported, older unsupported
        if (/Safari/i.test(browserName)) {
            const minorSegment = browserVersion?.split('.')?.[1];
            const minor = Number(minorSegment);
            return browserMajor > 16 || (browserMajor === 16 && minor >= 4);
        }

        // Opera >= 97 supported (equivalent to Chromium 111), older unsupported
        if (/Opera/i.test(browserName)) {
            return browserMajor >= 97;
        }

        // All internet explorer versions unsupported
        if (/IE/i.test(browserName)) return false;

        // Unknown browsers: assume unsupported to be safe
        return false;
    } catch (error) {
        return false;
    }
}

const BROWSER_UPDATE_URLS = {
    chrome: 'https://www.google.com/chrome/',
    chromium: 'https://www.google.com/chrome/',
    edge: 'https://www.microsoft.com/edge',
    firefox: 'https://www.mozilla.org/firefox/new/',
    opera: 'https://www.opera.com/download',
    safari: 'https://support.apple.com/en-us/108382'
};

function getDesktopUpdateUrl(parsed) {
    const name = parsed.browser?.name?.toLowerCase() ?? '';

    for (const key of Object.keys(BROWSER_UPDATE_URLS)) {
        if (name.includes(key)) {
            return BROWSER_UPDATE_URLS[key];
        }
    }

    return 'https://browsehappy.com/';
}

function getMobileUpdateUrl(parsed) {
    const isIOS = /iOS/i.test(parsed.os?.name);
    const isSafari = /Safari/i.test(parsed.browser?.name);

    if (isIOS) {
        // iOS Safari updates with iOS, other browsers update from app store
        return isSafari
            ? 'https://support.apple.com/HT204204'
            : 'https://support.apple.com/en-us/102629';
    }

    // Android: update browser from Play Store
    return 'https://support.google.com/googleplay/answer/113412';
}

function isMobile(parsed) {
    const deviceType = parsed.device?.type;
    return deviceType === 'mobile' || deviceType === 'tablet';
}

const UnsupportedBrowserWarning = () => {
    const parsed = useMemo(() => UAParser(), []);
    const mobile = useMemo(() => isMobile(parsed), [parsed]);
    const [visible, setVisible] = useState(() => {
        try {
            // Don't show if user previously dismissed
            if (sessionStorage.getItem('browser-support-dismissed') === '1') {
                return false;
            }
        } catch (error) {
            // sessionStorage may be unavailable (privacy mode, sandbox)
        }
        // Show warning if browser not supported
        return !isSupportedBrowser(parsed);
    });

    // Set session storage to prevent showing again if user dismisses warning
    const handleDismiss = useCallback(() => {
        setVisible(false);
        try {
            sessionStorage.setItem('browser-support-dismissed', '1');
        } catch (error) {
            // sessionStorage may be unavailable (privacy mode, sandbox)
        }
    }, []);

    if (!visible) return null;

    return (
        <div className={clsx(
            "fixed inset-0 z-1000",
            "flex items-center justify-center bg-neutral/80 p-4 text-center"
        )}>
            <div className={clsx(
                "bg-base-100 max-w-lg w-full rounded-box shadow-xl",
                "border border-base-300 overflow-hidden"
            )}>
                <div className="p-5 sm:p-6">
                    <h2 className="text-xl sm:text-2xl font-bold mb-3 text-warning">
                        Your browser is not supported
                    </h2>
                    <p className="mb-4 text-sm sm:text-base">
                        To ensure the app works correctly and displays data as
                        intended, please update your browser before continuing.
                    </p>
                    <div className="grid gap-2 sm:gap-3">
                        {mobile ? (
                            <a
                                className="btn btn-accent mx-auto"
                                href={getMobileUpdateUrl(parsed)}
                                target="_blank"
                                rel="noreferrer noopener"
                            >
                                Show me how to update
                            </a>
                        ) : (
                            <a
                                className="btn btn-accent mx-auto"
                                href={getDesktopUpdateUrl(parsed)}
                                target="_blank"
                                rel="noreferrer noopener"
                            >
                                Update your browser
                            </a>
                        )}
                    </div>
                </div>
                <div className="bg-base-200 px-5 py-4 sm:px-6 sm:py-5 border-t border-base-300">
                    <div className="flex flex-col gap-3">
                        <p className="text-xs sm:text-sm opacity-80">
                            If you really want to try, press and hold to continue.
                            <br />
                            Expect display and functionality issues.
                        </p>
                        <HoldToConfirm
                            callback={handleDismiss}
                            timeout={2000}
                            buttonText="Continue anyway"
                            tooltipText="Keep holding to proceed"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UnsupportedBrowserWarning;
