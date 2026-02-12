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
import Bancos from './pages/Bancos';
import Cajas from './pages/Cajas';
import Cheques from './pages/Cheques';
import Cobros from './pages/Cobros';
import ConfiguracionUnificada from './pages/ConfiguracionUnificada';
import ConfirmarSalida from './pages/ConfirmarSalida';
import CuentaCorriente from './pages/CuentaCorriente';
import Egresos from './pages/Egresos';
import Empleados from './pages/Empleados';
import Historial from './pages/Historial';
import Home from './pages/Home';
import Informes from './pages/Informes';
import InformesContables from './pages/InformesContables';
import IngresoFruta from './pages/IngresoFruta';
import IngresosVarios from './pages/IngresosVarios';
import Inventario from './pages/Inventario';
import MovimientoEnvases from './pages/MovimientoEnvases';
import MovimientoFruta from './pages/MovimientoFruta';
import MovimientosTesoreria from './pages/MovimientosTesoreria';
import Pagos from './pages/Pagos';
import Perdidas from './pages/Perdidas';
import SaldosEnvases from './pages/SaldosEnvases';
import SalidaFruta from './pages/SalidaFruta';
import Tesoreria from './pages/Tesoreria';


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