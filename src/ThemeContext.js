import React, { createContext, useContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
    // Load selected theme from localStorage, or default to dark if not set
    const initialTheme = localStorage.getItem('theme') || 'dark';
    const [theme, setTheme] = useState(initialTheme);

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

    // Navbar menu option component
    const ToggleThemeOption = () => {
        switch(theme) {
            case('light'):
                return <li><a onClick={toggleTheme}>Dark mode</a></li>;
            case('dark'):
                return <li><a onClick={toggleTheme}>Light mode</a></li>;
        }
    };

    return (
        <ThemeContext.Provider value={{ toggleTheme, ToggleThemeOption }}>
            {children}
        </ThemeContext.Provider>
    );
};

ThemeProvider.propTypes = {
    children: PropTypes.node,
};
