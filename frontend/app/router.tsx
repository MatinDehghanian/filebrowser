import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import RootPage from "@/app/page";
import LoginPage from "@/app/login/page";
import SharePage from "@/app/share/[hash]/page";
import AuthenticatedLayout from "@/app/(authenticated)/layout";
import FilesPage from "@/app/(authenticated)/files/[[...path]]/page";
import GlobalSettingsPage from "@/app/(authenticated)/settings/global/page";
import UsersSettingsPage from "@/app/(authenticated)/settings/users/page";
import ProfileSettingsPage from "@/app/(authenticated)/settings/profile/page";
import SharesSettingsPage from "@/app/(authenticated)/settings/shares/page";

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<RootPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/share/:hash" element={<SharePage />} />

      <Route
        element={
          <AuthenticatedLayout>
            <Outlet />
          </AuthenticatedLayout>
        }
      >
        <Route path="/files/*" element={<FilesPage />} />
        <Route path="/settings/profile" element={<ProfileSettingsPage />} />
        <Route path="/settings/shares" element={<SharesSettingsPage />} />
        <Route path="/settings/users" element={<UsersSettingsPage />} />
        <Route path="/settings/global" element={<GlobalSettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/files/" replace />} />
    </Routes>
  );
}