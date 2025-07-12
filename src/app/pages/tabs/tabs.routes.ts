import { Routes } from '@angular/router';
import { TabsPage } from './tabs.page';
import { AuthGuard } from '../../guards/auth.guard';
import { OnboardingGuard } from '../../guards/onboarding.guard';

export const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    canActivate: [AuthGuard, OnboardingGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./dashboard/tab1.page').then((m) => m.Tab1Page),
      },
      {
        path: 'journal',
        loadComponent: () =>
          import('./journal/tab2.page').then((m) => m.Tab2Page),
      },
      {
        path: 'tracker',
        loadComponent: () =>
          import('./tracker/tab3.page').then((m) => m.Tab3Page),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./settings/tab4.page').then((m) => m.Tab4Page),
      },
      {
        path: '',
        redirectTo: '/tabs/dashboard',
        pathMatch: 'full',
      },
    ],
  },
];
