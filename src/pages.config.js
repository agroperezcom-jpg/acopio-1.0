/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import React from 'react';

const Bancos = React.lazy(() => import('./pages/Bancos'));
const Cajas = React.lazy(() => import('./pages/Cajas'));
const Cheques = React.lazy(() => import('./pages/Cheques'));
const Cobros = React.lazy(() => import('./pages/Cobros'));
const ConfiguracionUnificada = React.lazy(() => import('./pages/ConfiguracionUnificada'));
const ConfirmarSalida = React.lazy(() => import('./pages/ConfirmarSalida'));
const CuentaCorriente = React.lazy(() => import('./pages/CuentaCorriente'));
const Egresos = React.lazy(() => import('./pages/Egresos'));
const Empleados = React.lazy(() => import('./pages/Empleados'));
const Historial = React.lazy(() => import('./pages/Historial'));
const Home = React.lazy(() => import('./pages/Home'));
const Informes = React.lazy(() => import('./pages/Informes'));
const InformesContables = React.lazy(() => import('./pages/InformesContables'));
const IngresoFruta = React.lazy(() => import('./pages/IngresoFruta'));
const IngresosVarios = React.lazy(() => import('./pages/IngresosVarios'));
const Inventario = React.lazy(() => import('./pages/Inventario'));
const MovimientoEnvases = React.lazy(() => import('./pages/MovimientoEnvases'));
const MovimientoFruta = React.lazy(() => import('./pages/MovimientoFruta'));
const MovimientosTesoreria = React.lazy(() => import('./pages/MovimientosTesoreria'));
const Pagos = React.lazy(() => import('./pages/Pagos'));
const Perdidas = React.lazy(() => import('./pages/Perdidas'));
const SaldosEnvases = React.lazy(() => import('./pages/SaldosEnvases'));
const SalidaFruta = React.lazy(() => import('./pages/SalidaFruta'));
const Tesoreria = React.lazy(() => import('./pages/Tesoreria'));


export const PAGES = {
    "Bancos": Bancos,
    "Cajas": Cajas,
    "Cheques": Cheques,
    "Cobros": Cobros,
    "ConfiguracionUnificada": ConfiguracionUnificada,
    "ConfirmarSalida": ConfirmarSalida,
    "CuentaCorriente": CuentaCorriente,
    "Egresos": Egresos,
    "Empleados": Empleados,
    "Historial": Historial,
    "Home": Home,
    "Informes": Informes,
    "InformesContables": InformesContables,
    "IngresoFruta": IngresoFruta,
    "IngresosVarios": IngresosVarios,
    "Inventario": Inventario,
    "MovimientoEnvases": MovimientoEnvases,
    "MovimientoFruta": MovimientoFruta,
    "MovimientosTesoreria": MovimientosTesoreria,
    "Pagos": Pagos,
    "Perdidas": Perdidas,
    "SaldosEnvases": SaldosEnvases,
    "SalidaFruta": SalidaFruta,
    "Tesoreria": Tesoreria,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: null,
};