import React, { lazy } from 'react';
import { Routes as RouterRoutes, Route, Navigate } from 'react-router-dom';

// Lightweight placeholders (will be swapped with real adapters in Phase 3)
const Overview = lazy(() => import(/* webpackChunkName: "overview_adapter" */ './adapters/Overview'));
const Archived = lazy(() => import(/* webpackChunkName: "archived_adapter" */ './adapters/Archived'));
const Manage = lazy(() => import(/* webpackChunkName: "manage_adapter" */ './adapters/Manage'));
const Login = lazy(() => import(/* webpackChunkName: "login_adapter" */ './adapters/Login'));
const UserProfile = lazy(() => import(/* webpackChunkName: "user_profile_adapter" */ './adapters/UserProfile'));
const PasswordReset = lazy(() => import(/* webpackChunkName: "password_reset_adapter" */ './adapters/PasswordReset'));
const PasswordResetConfirm = lazy(() => import(/* webpackChunkName: "password_reset_confirm_adapter" */ './adapters/PasswordResetConfirm'));
const PermissionDenied = lazy(() => import(/* webpackChunkName: "permission_denied_adapter" */ './adapters/PermissionDenied'));

export default function Routes() {
    return (
        <RouterRoutes>
            <Route path="/" element={<Overview />} />
            <Route path="/archived" element={<Archived />} />
            <Route path="/manage/:uuid" element={<Manage />} />

            <Route path="/accounts/login/" element={<Login />} />
            <Route path="/accounts/profile/" element={<UserProfile />} />
            <Route path="/accounts/password_reset/" element={<PasswordReset />} />
            <Route path="/accounts/reset/:uidb64/:token/" element={<PasswordResetConfirm />} />

            <Route path="/permission_denied" element={<PermissionDenied />} />

            {/* Fallback to overview */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </RouterRoutes>
    );
}


