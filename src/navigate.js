// Stores function returned by useNavigate()
let _navigate = null;

// Called in RootLayout to set navigate function
export const setNavigate = (navigate) => {
    _navigate = navigate;
};

// Global navigate function (can be imported by functions that can't use hooks)
export const navigate = (to, opts) => _navigate(to, opts);
