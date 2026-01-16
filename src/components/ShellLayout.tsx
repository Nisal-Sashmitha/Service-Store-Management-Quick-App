import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { QuickActionsProvider } from './QuickActionsProvider'

function NavItem(props: { to: string; label: string }) {
  return (
    <NavLink
      to={props.to}
      className={({ isActive }) => (isActive ? 'navItem navItemActive' : 'navItem')}
    >
      {props.label}
    </NavLink>
  )
}

function DrawerItem(props: { to: string; label: string; onNavigate: () => void }) {
  return (
    <NavLink
      to={props.to}
      onClick={props.onNavigate}
      className={({ isActive }) => (isActive ? 'drawerItem drawerItemActive' : 'drawerItem')}
    >
      {props.label}
    </NavLink>
  )
}

export function ShellLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="appShell">
      <main className="appMain">
        <QuickActionsProvider>
          <Outlet />
        </QuickActionsProvider>
      </main>
      <nav className="bottomNav" aria-label="Primary">
        <NavItem to="/" label="Tickets" />
        <NavItem to="/calendar" label="Calendar" />
        <NavItem to="/finance" label="Finance" />
        <NavItem to="/settings" label="Settings" />
      </nav>

      <button className="navFab" type="button" aria-label="Open menu" onClick={() => setDrawerOpen(true)}>
        ☰
      </button>

      {drawerOpen ? (
        <div
          className="drawerOverlay"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDrawerOpen(false)
          }}
        >
          <div className="drawer">
            <div className="drawerHeader">
              <div className="drawerTitle">Menu</div>
              <button className="iconButton" type="button" onClick={() => setDrawerOpen(false)} aria-label="Close menu">
                ×
              </button>
            </div>
            <div className="drawerLinks">
              <DrawerItem to="/" label="Tickets" onNavigate={() => setDrawerOpen(false)} />
              <DrawerItem to="/calendar" label="Calendar" onNavigate={() => setDrawerOpen(false)} />
              <DrawerItem to="/finance" label="Finance" onNavigate={() => setDrawerOpen(false)} />
              <DrawerItem to="/settings" label="Settings" onNavigate={() => setDrawerOpen(false)} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
