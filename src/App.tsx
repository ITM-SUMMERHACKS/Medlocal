import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

import SearchPage from "./pages/patient/SearchPage";
import Cart from "./pages/patient/Cart";
import MyOrders from "./pages/patient/MyOrders";
import ScanPrescription from "./pages/patient/ScanPrescription";
import BloodBank from "./pages/patient/BloodBank";
import Doctors from "./pages/patient/Doctors";

import PharmacyOrders from "./pages/pharmacy/PharmacyOrders";
import Inventory from "./pages/pharmacy/Inventory";
import Analytics from "./pages/pharmacy/Analytics";

import DoctorDashboard from "./pages/doctor/DoctorDashboard";
import PatientHeatmap from "./pages/doctor/PatientHeatmap";

import AdminDashboard from "./pages/admin/AdminDashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />

              {/* Patient */}
              <Route path="/app" element={<ProtectedRoute allow={["patient"]}><SearchPage /></ProtectedRoute>} />
              <Route path="/app/cart" element={<ProtectedRoute allow={["patient"]}><Cart /></ProtectedRoute>} />
              <Route path="/app/orders" element={<ProtectedRoute allow={["patient"]}><MyOrders /></ProtectedRoute>} />
              <Route path="/app/scan" element={<ProtectedRoute allow={["patient"]}><ScanPrescription /></ProtectedRoute>} />
              <Route path="/app/blood" element={<ProtectedRoute><BloodBank /></ProtectedRoute>} />
              <Route path="/app/doctors" element={<ProtectedRoute allow={["patient"]}><Doctors /></ProtectedRoute>} />

              {/* Pharmacy */}
              <Route path="/pharmacy" element={<ProtectedRoute allow={["pharmacy"]}><PharmacyOrders /></ProtectedRoute>} />
              <Route path="/pharmacy/inventory" element={<ProtectedRoute allow={["pharmacy"]}><Inventory /></ProtectedRoute>} />
              <Route path="/pharmacy/analytics" element={<ProtectedRoute allow={["pharmacy"]}><Analytics /></ProtectedRoute>} />

              {/* Doctor */}
              <Route path="/doctor" element={<ProtectedRoute allow={["doctor"]}><DoctorDashboard /></ProtectedRoute>} />
              <Route path="/doctor/heatmap" element={<ProtectedRoute allow={["doctor"]}><PatientHeatmap /></ProtectedRoute>} />

              {/* Admin */}
              <Route path="/admin" element={<ProtectedRoute allow={["admin"]}><AdminDashboard /></ProtectedRoute>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
