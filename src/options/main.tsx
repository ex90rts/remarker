import React from "react";
import { createRoot } from "react-dom/client";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { App } from "./App";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      light: "#60a5fa",
      main: "#0042d3",
      dark: "#1d4ed8",
      contrastText: "#ffffff"
    },
    secondary: {
      light: "#38bdf8",
      main: "#0284c7",
      dark: "#0369a1",
      contrastText: "#ffffff"
    },
    background: {
      default: "#f6f9ff"
    }
  },
  shape: {
    borderRadius: 6
  },
  typography: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, "Helvetica Neue", Arial, sans-serif'
  }
});

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
