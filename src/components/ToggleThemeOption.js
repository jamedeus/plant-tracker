import React, { useState, useEffect } from 'react';

const ToggleThemeOption = () => {
    // Load selected theme from localStorage, or default to dark if not set
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

    // Write new theme to localStorage when changed (persistence)
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    // Listen for changes to stored theme (respond to change in other tabs)
    useEffect(() => {
        const handleChange = (event) => {
            if (event.key === 'theme') {
                setTheme(event.newValue);
            }
        };
        window.addEventListener('storage', handleChange);
        return () => window.removeEventListener('storage', handleChange);
    }, []);

    const toggleTheme = () => {
        setTheme((prevTheme) => (prevTheme === 'dark' ? 'light' : 'dark'));
    };

    switch(theme) {
        case('light'):
            return <li><button onClick={toggleTheme}>Dark mode</button></li>;
        case('dark'):
            return <li><button onClick={toggleTheme}>Light mode</button></li>;
    }
};

export default ToggleThemeOption;
