import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import { Dashboard } from "./pages/Dashboard";
import { Editor } from "./pages/Editor";
import { Sign } from "./pages/Sign";
import { Layout } from "./components/Layout";
import { Toaster } from "react-hot-toast";

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="editor/:id" element={<Editor />} />
        </Route>
        <Route path="sign/:token" element={<Sign />} />
      </Routes>
    </BrowserRouter>
  );
}
