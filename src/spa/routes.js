import React from 'react';
import PropTypes from 'prop-types';
import { Routes as RouterRoutes, Route, Navigate, useLocation } from 'react-router-dom';
import Prefetched from './Prefetched';
import {
    OverviewApp,
    ManagePlantApp,
    ManageGroupApp,
    RegisterApp,
    LoginApp,
    UserProfileApp,
    PasswordResetApp,
    PermissionDeniedApp,
} from './bundles';

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
