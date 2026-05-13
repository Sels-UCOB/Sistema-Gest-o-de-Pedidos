import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./lib/Layout";
import ProductsPage from "./pages/ProductsPage";
import OrdersPage from "./pages/OrdersPage";
import ShipmentsPage from "./pages/ShipmentsPage";
import LandingPage from "./pages/LandingPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/" element={<Layout />}>
          {<Route path="products" element={<ProductsPage />} />}
          <Route path="orders/*" element={<OrdersPage />} />
          <Route path="shipments/*" element={<ShipmentsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );}