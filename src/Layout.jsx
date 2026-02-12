import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { 
  Apple, 
  ArrowLeftRight, 
  History, 
  FileText, 
  Package, 
  Menu,
  Home,
  Settings,
  Sliders,
  TrendingDown,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Users,
  Wallet,
  Banknote,
  Receipt,
  CreditCard,
  Landmark,
  HandCoins,
  PiggyBank,
  Scale
} from "lucide-react";

const navItems = [
  { name: 'Inicio', icon: Home, page: 'Home' },
  { name: 'Movimiento de Fruta', icon: Apple, page: 'MovimientoFruta' },
  { name: 'Inventario', icon: Package, page: 'Inventario' },
  { name: 'Historial', icon: History, page: 'Historial' },
  { name: 'Pérdidas', icon: Apple, page: 'Perdidas' },
  { name: 'Saldos', icon: Package, page: 'SaldosEnvases' },
  { name: 'Egresos', icon: TrendingDown, page: 'Egresos' },
  { name: 'Ingresos Varios', icon: TrendingUp, page: 'IngresosVarios' },
  {
    name: 'Tesorería',
    icon: Wallet,
    page: 'Tesoreria',
    subItems: [
      { name: 'Panel Principal', icon: PiggyBank, page: 'Tesoreria' },
      { name: 'Cuentas Corrientes', icon: Scale, page: 'CuentaCorriente' },
      { name: 'Pagos', icon: HandCoins, page: 'Pagos' },
      { name: 'Cobros', icon: Receipt, page: 'Cobros' },
      { name: 'Cajas', icon: Landmark, page: 'Cajas' },
      { name: 'Bancos', icon: Banknote, page: 'Bancos' },
      { name: 'Cheques', icon: CreditCard, page: 'Cheques' },
      { name: 'Movimientos Internos', icon: ArrowLeftRight, page: 'MovimientosTesoreria' }
    ]
  },
  { name: 'Informes Contables', icon: FileText, page: 'InformesContables' },
  { name: 'Empleados', icon: Users, page: 'Empleados' },
  { name: 'Configuración', icon: Sliders, page: 'ConfiguracionUnificada' },
];

export default function Layout({ children, currentPageName }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedMenus, setExpandedMenus] = useState({ 'Tesoreria': true });

  const toggleMenu = (itemName) => {
    setExpandedMenus(prev => ({ ...prev, [itemName]: !prev[itemName] }));
  };

  const NavLink = ({ item, mobile = false, collapsed = false }) => {
    const isActive = currentPageName === item.page;
    const hasSubItems = item.subItems && item.subItems.length > 0;
    const isExpanded = expandedMenus[item.page];
    const isSubPageActive = hasSubItems && item.subItems.some(sub => currentPageName === sub.page);

    if (hasSubItems) {
      return (
        <div>
          <button
            onClick={() => {
              if (collapsed) {
                setSidebarOpen(true);
              }
              toggleMenu(item.page);
              if (mobile) setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              isActive || isSubPageActive
                ? 'bg-green-100 text-green-700 font-medium' 
                : 'text-slate-600 hover:bg-slate-100'
            } ${collapsed ? 'justify-center' : ''}`}
            title={collapsed ? item.name : ''}
          >
            <item.icon className={`h-5 w-5 ${isActive || isSubPageActive ? 'text-green-600' : 'text-slate-400'} shrink-0`} />
            {!collapsed && (
              <>
                <span className="flex-1 text-left">{item.name}</span>
                <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
              </>
            )}
          </button>
          {!collapsed && isExpanded && (
            <div className="ml-4 mt-1 space-y-1">
              {item.subItems.map(subItem => (
                <Link
                  key={subItem.page}
                  to={createPageUrl(subItem.page)}
                  onClick={() => mobile && setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all ${
                    currentPageName === subItem.page
                      ? 'bg-green-100 text-green-700 font-medium' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <subItem.icon className={`h-4 w-4 ${currentPageName === subItem.page ? 'text-green-600' : 'text-slate-400'}`} />
                  <span className="text-sm">{subItem.name}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link
        to={createPageUrl(item.page)}
        onClick={() => mobile && setMobileMenuOpen(false)}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
          isActive 
            ? 'bg-green-100 text-green-700 font-medium' 
            : 'text-slate-600 hover:bg-slate-100'
        } ${collapsed ? 'justify-center' : ''}`}
        title={collapsed ? item.name : ''}
      >
        <item.icon className={`h-5 w-5 ${isActive ? 'text-green-600' : 'text-slate-400'} shrink-0`} />
        {!collapsed && <span>{item.name}</span>}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop Sidebar */}
      <aside 
        className={`hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:flex-col transition-all duration-300 ease-in-out ${sidebarOpen ? 'lg:w-64' : 'lg:w-20'}`}
      >
        <div className="flex flex-col flex-grow bg-white border-r border-slate-200 pt-5 overflow-y-auto overflow-x-hidden relative">
          {/* Logo and Toggle */}
          <div className={`flex items-center pb-6 px-4 ${sidebarOpen ? 'justify-between' : 'flex-col gap-4'}`}>
            {sidebarOpen ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
                    <img 
                      src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/694c069ad9a3c71a10fee653/2db155312_imagenesdeperfilISO_Mesadetrabajo1.jpg"
                      alt="Logo Acopio"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <h1 className="font-bold text-slate-800">Acopio</h1>
                    <p className="text-xs text-slate-500">Gestión de Frutas</p>
                  </div>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
                  title="Contraer menú"
                >
                  <ChevronLeft className="h-5 w-5 text-slate-600" />
                </button>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden">
                  <img 
                    src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/694c069ad9a3c71a10fee653/2db155312_imagenesdeperfilISO_Mesadetrabajo1.jpg"
                    alt="Logo Acopio"
                    className="w-full h-full object-contain"
                  />
                </div>
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-2 rounded-lg hover:bg-slate-100 transition-colors w-full"
                  title="Expandir menú"
                >
                  <ChevronRight className="h-5 w-5 text-slate-600 mx-auto" />
                </button>
              </>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 space-y-1">
            {navItems.map((item) => (
              <NavLink key={item.page} item={item} collapsed={!sidebarOpen} />
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-slate-100">
            <Button
              variant="ghost"
              onClick={() => base44.auth.logout()}
              className={`w-full text-red-600 hover:text-red-700 hover:bg-red-50 ${sidebarOpen ? 'justify-start' : 'justify-center p-2'}`}
              title="Cerrar Sesión"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {sidebarOpen && <span className="ml-2">Cerrar Sesión</span>}
            </Button>
            {sidebarOpen && (
              <p className="text-xs text-slate-400 text-center mt-2">
                Sistema de Acopio v1.0
              </p>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden">
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/694c069ad9a3c71a10fee653/2db155312_imagenesdeperfilISO_Mesadetrabajo1.jpg"
                alt="Logo Acopio"
                className="w-full h-full object-contain"
              />
            </div>
            <span className="font-bold text-slate-800">Acopio</span>
          </div>
          
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0">
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between p-4 border-b">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden">
                      <img 
                        src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/694c069ad9a3c71a10fee653/2db155312_imagenesdeperfilISO_Mesadetrabajo1.jpg"
                        alt="Logo Acopio"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <span className="font-bold text-slate-800">Menú</span>
                  </div>
                </div>
                <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                  {navItems.map((item) => (
                    <NavLink key={item.page} item={item} mobile />
                  ))}
                </nav>
                <div className="p-3 border-t border-slate-200">
                  <Button
                    variant="ghost"
                    onClick={() => base44.auth.logout()}
                    className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Cerrar Sesión
                  </Button>
                </div>
                </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Main Content */}
      <main className={`transition-all duration-300 ease-in-out ${sidebarOpen ? 'lg:pl-64' : 'lg:pl-20'}`}>
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40 safe-area-bottom">
        <div className="flex items-center justify-around py-2 overflow-x-auto">
          {navItems.slice(0, 6).map((item) => {
            const isActive = currentPageName === item.page;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                  isActive ? 'text-green-600' : 'text-slate-500'
                }`}
              >
                <item.icon className={`h-5 w-5 ${isActive ? 'text-green-600' : 'text-slate-400'}`} />
                <span className="text-[10px] font-medium">{item.name.split(' ')[0]}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Padding for bottom nav on mobile */}
      <div className="lg:hidden h-16" />
    </div>
  );
}