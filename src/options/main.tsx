import React from "react";
import { createRoot } from "react-dom/client";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { App } from "./App";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      light: "#e7efff",
      main: "#2764dc",
      dark: "#1e4eb2",
      contrastText: "#ffffff"
    },
    secondary: {
      light: "#d8f5ef",
      main: "#139d8f",
      dark: "#0c766c",
      contrastText: "#ffffff"
    },
    background: {
      default: "#f4f6fa",
      paper: "#ffffff"
    },
    text: {
      primary: "#19243a",
      secondary: "#65728b"
    },
    divider: "#e4e9f2"
  },
  shape: {
    borderRadius: 8
  },
  typography: {
    fontFamily:
      '"Segoe UI", "PingFang SC", sans-serif',
    h4: {
      fontSize: "1.5rem",
      fontWeight: 750,
      letterSpacing: 0
    },
    h6: {
      fontSize: "0.95rem",
      fontWeight: 750,
      letterSpacing: 0
    },
    button: {
      fontWeight: 700,
      letterSpacing: 0,
      textTransform: "none"
    }
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: "#f4f6fa"
        },
        "*": {
          scrollbarColor: "#c8d2e3 transparent",
          scrollbarWidth: "thin"
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 7,
          boxShadow: "none",
          minHeight: 34,
          paddingLeft: 12,
          paddingRight: 12
        },
        contained: {
          boxShadow: "0 4px 10px rgba(39, 100, 220, 0.2)",
          "&:hover": {
            boxShadow: "0 6px 14px rgba(39, 100, 220, 0.26)"
          }
        },
        outlined: {
          borderColor: "#d4ddeb",
          color: "#34435e"
        }
      }
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 7,
          "&:hover": {
            backgroundColor: "#edf3ff"
          }
        }
      }
    },
    MuiTextField: {
      defaultProps: {
        size: "small"
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: "#ffffff",
          borderRadius: 7,
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "#aab9d1"
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderWidth: 1,
            borderColor: "#2764dc"
          }
        },
        notchedOutline: {
          borderColor: "#d8e0ed"
        }
      }
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          backgroundColor: "#f7f9fd",
          color: "#56647d",
          fontSize: "0.72rem",
          fontWeight: 750,
          letterSpacing: 0,
          textTransform: "uppercase"
        },
        root: {
          borderColor: "#edf0f5"
        }
      }
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:last-child td": {
            borderBottom: 0
          },
          "&:hover": {
            backgroundColor: "#fafcff"
          }
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: "0 10px 28px rgba(34, 52, 84, 0.06)"
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 700
        }
      }
    }
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
