'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles?: string[];
  badge?: number;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'Principal',
    items: [
      {
        href: '/dashboard',
        label: 'Tableau de bord',
        icon: 'dashboard',
      },
      {
        href: '/properties',
        label: 'Hébergements',
        icon: 'home',
        roles: ['ministry', 'admin'],
      },
      {
        href: '/etablissements',
        label: 'Hôtels & Auberges',
        icon: 'apartment',
        roles: ['ministry', 'admin'],
      },
      {
        href: '/guests',
        label: 'Voyageurs',
        icon: 'group',
        roles: ['police', 'admin'],
      },
    ],
  },
  {
    title: 'Sécurité',
    items: [
      {
        href: '/alerts',
        label: 'Alertes',
        icon: 'notifications_active',
        roles: ['police', 'admin'],
        badge: 3,
      },
      {
        href: '/map',
        label: 'Carte',
        icon: 'map',
      },
      {
        href: '/reports',
        label: 'Rapports',
        icon: 'description',
        roles: ['ministry', 'admin'],
      },
    ],
  },
  {
    title: 'OSINT',
    items: [
      {
        href: '/osint-verify-traveler',
        label: 'Vérifier Voyageur',
        icon: 'verified_user',
        roles: ['police', 'admin'],
      },
      {
        href: '/osint-profile',
        label: 'Profil Complet',
        icon: 'person_search',
        roles: ['police', 'admin'],
      },
    ],
  },
  {
    title: 'Finances',
    items: [
      {
        href: '/revenue',
        label: 'Recettes TPT',
        icon: 'payments',
        roles: ['tax_authority', 'ministry', 'admin'],
      },
      {
        href: '/intelligence',
        label: 'Intelligence Marché',
        icon: 'insights',
        roles: ['ministry', 'tax_authority', 'admin'],
      },
    ],
  },
  {
    title: 'Système',
    items: [
      {
        href: '/users',
        label: 'Utilisateurs',
        icon: 'manage_accounts',
        roles: ['admin'],
      },
      {
        href: '/settings',
        label: 'Paramètres',
        icon: 'settings',
        roles: ['admin'],
      },
    ],
  },
];

interface SidebarProps {
  userRole?: string;
  userName?: string;
  userOrganization?: string;
}

export function Sidebar({
  userRole = 'admin',
  userName = 'Agent Admin',
  userOrganization = 'Ministère du Tourisme',
}: SidebarProps) {
  const pathname = usePathname();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'police':
        return 'Police Nationale';
      case 'ministry':
        return 'Ministère du Tourisme';
      case 'tax_authority':
        return 'Direction des Impôts';
      case 'admin':
        return 'Administrateur';
      default:
        return role;
    }
  };

  return (
    <aside className="w-64 fixed inset-y-0 left-0 bg-sidebar dark:bg-sidebar-dark border-r border-gray-200 dark:border-gray-800 flex flex-col z-30 transition-all duration-300">
      {/* Logo Header */}
      <div className="h-16 flex items-center px-6 border-b border-gray-200 dark:border-gray-800">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center text-white">
            <span className="material-symbols-outlined text-xl">verified_user</span>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-gray-900 dark:text-white leading-none">
              Gestoo
            </span>
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">
              Administration
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
        {navSections.map((section) => {
          const filteredItems = section.items.filter(
            (item) => !item.roles || item.roles.includes(userRole)
          );

          if (filteredItems.length === 0) return null;

          return (
            <div key={section.title}>
              <div className="px-3 mb-2 mt-4 first:mt-0">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {section.title}
                </span>
              </div>

              {filteredItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors group ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-primary'
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined transition-colors ${
                        isActive
                          ? 'text-primary'
                          : 'text-gray-400 group-hover:text-primary'
                      }`}
                    >
                      {item.icon}
                    </span>
                    {item.label}
                    {item.badge && (
                      <span className="ml-auto bg-red-100 text-red-600 py-0.5 px-2 rounded-full text-xs font-bold">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* User Profile Footer */}
      <div className="border-t border-gray-200 dark:border-gray-800 p-4 bg-gray-50 dark:bg-gray-900/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
            {getInitials(userName)}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {userName}
            </span>
            <span className="text-xs text-gray-500 truncate">
              {userOrganization || getRoleLabel(userRole)}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
