import React, { lazy } from 'react';
import PropTypes from 'prop-types';
import { Routes as RouterRoutes, Route, Navigate, useLocation } from 'react-router-dom';
import Prefetched from './Prefetched';

// Page bundles
const OverviewApp = lazy(() => import(/* webpackChunkName: "overview_app" */ 'src/pages/overview/App'));
const ManagePlantApp = lazy(() => import(/* webpackChunkName: "manage_plant_app" */'src/pages/manage_plant/App'));
const ManageGroupApp = lazy(() => import(/* webpackChunkName: "manage_group_app" */ 'src/pages/manage_group/App'));
const RegisterApp = lazy(() => import(/* webpackChunkName: "register_app" */ 'src/pages/register/App'));
const LoginApp = lazy(() => import(/* webpackChunkName: "login_app" */ 'src/pages/login/App'));
const UserProfileApp = lazy(() => import(/* webpackChunkName: "user_profile_app" */ 'src/pages/user_profile/App'));
const PasswordResetApp = lazy(() => import(/* webpackChunkName: "password_reset_app" */ 'src/pages/password_reset/App'));
const PermissionDeniedApp = lazy(() => import(/* webpackChunkName: "permission_denied_app" */ 'src/pages/permission_denied/App'));

export default function Routes({ location }) {
    const routerLocation = location || useLocation();
    return (
        <RouterRoutes location={routerLocation}>
            <Route path="/" element={<Prefetched render={(data) => (
                <OverviewApp initialState={data} />
            )} />} />
            <Route path="/archived" element={<Prefetched render={(data) => (
                <OverviewApp initialState={data} />
            )} />} />
            <Route path="/manage/:uuid" element={<Prefetched render={(data) => {
                switch (data.page) {
                    case 'manage_plant':
                        return <ManagePlantApp initialState={data.state || {}} />;
                    case 'manage_group':
                        return <ManageGroupApp initialState={data.state || {}} />;
                    case 'register':
                        return <RegisterApp initialState={data.state || {}} />;
                    default:
                        return null;
                }
            }} />} />

            <Route path="/accounts/login/" element={<LoginApp />} />
            <Route path="/accounts/profile/" element={<Prefetched render={(data) => (
                <UserProfileApp initialState={data} />
            )} />} />
            <Route path="/accounts/password_reset/" element={<PasswordResetApp />} />
            <Route path="/accounts/reset/:uidb64/:token/" element={<PasswordResetApp />} />

            <Route path="/permission_denied" element={<PermissionDeniedApp />} />

            {/* Fallback to overview */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </RouterRoutes>
    );
}

Routes.propTypes = {
    location: PropTypes.object.isRequired,
};
