import React from 'react';

// Takes import statement, wraps in React.lazy and adds preload method
// Can be used like a normal lazy load component, or call preload to fetch
// component in parallel with initial state
function lazyWithPreload(importer) {
    const Component = React.lazy(importer);
    Component.preload = importer;
    return Component;
}

export const OverviewApp = lazyWithPreload(() => import(/* webpackChunkName: "overview_app" */ 'src/pages/overview/App'));

export const ManagePlantApp = lazyWithPreload(() => import(/* webpackChunkName: "manage_plant_app" */ 'src/pages/manage_plant/App'));

export const ManageGroupApp = lazyWithPreload(() => import(/* webpackChunkName: "manage_group_app" */ 'src/pages/manage_group/App'));

export const RegisterApp = lazyWithPreload(() => import(/* webpackChunkName: "register_app" */ 'src/pages/register/App'));

export const LoginApp = lazyWithPreload(() => import(/* webpackChunkName: "login_app" */ 'src/pages/login/App'));

export const UserProfileApp = lazyWithPreload(() => import(/* webpackChunkName: "user_profile_app" */ 'src/pages/user_profile/App'));

export const PasswordResetApp = lazyWithPreload(() => import(/* webpackChunkName: "password_reset_app" */ 'src/pages/password_reset/App'));

export const ErrorPageApp = lazyWithPreload(() => import(/* webpackChunkName: "error_page_app" */ 'src/pages/error_page/App'));
