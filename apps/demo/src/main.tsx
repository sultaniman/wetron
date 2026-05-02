import React from "react";
import { createRoot } from "react-dom/client";
import "@wetron/react/dist/index.css";
import App from "./App.tsx";

const root = document.getElementById("root")!;
createRoot(root).render(<App />);
