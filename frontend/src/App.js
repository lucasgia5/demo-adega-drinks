import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { StoreCfgProvider } from "@/context/StoreConfigContext";

import Storefront from "@/pages/Storefront";
import ProductDetail from "@/pages/ProductDetail";
import Checkout from "@/pages/Checkout";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Account from "@/pages/Account";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminProducts from "@/pages/admin/Products";
import AdminCategories from "@/pages/admin/Categories";
import AdminOrders from "@/pages/admin/Orders";
import ProtectedRoute from "@/components/ProtectedRoute";

function App() {
  return (
    <div className="App">
      <StoreCfgProvider>
        <AuthProvider>
          <CartProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Storefront />} />
                <Route path="/produto/:id" element={<ProductDetail />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/login" element={<Login />} />
                <Route path="/cadastro" element={<Register />} />
                <Route path="/conta" element={
                  <ProtectedRoute><Account /></ProtectedRoute>
                } />

                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin" element={
                  <ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>
                } />
                <Route path="/admin/produtos" element={
                  <ProtectedRoute requireAdmin><AdminProducts /></ProtectedRoute>
                } />
                <Route path="/admin/categorias" element={
                  <ProtectedRoute requireAdmin><AdminCategories /></ProtectedRoute>
                } />
                <Route path="/admin/pedidos" element={
                  <ProtectedRoute requireAdmin><AdminOrders /></ProtectedRoute>
                } />
              </Routes>
              <Toaster position="top-right" richColors />
            </BrowserRouter>
          </CartProvider>
        </AuthProvider>
      </StoreCfgProvider>
    </div>
  );
}

export default App;
