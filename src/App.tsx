/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./lib/Layout";
import ProductsPage from "./pages/ProductsPage";
import OrdersPage from "./pages/OrdersPage";
import ShipmentsPage from "./pages/ShipmentsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/products" replace />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="orders/*" element={<OrdersPage />} />
          <Route path="shipments/*" element={<ShipmentsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
