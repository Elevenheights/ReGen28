import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable, map, tap, filter, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable({
	providedIn: 'root'
})
export class AuthGuard implements CanActivate {

	constructor(
		private authService: AuthService,
		private router: Router
	) { }

	canActivate(): Observable<boolean> {
		return this.authService.authState$.pipe(
			// Wait until auth state is undetermined (loading) or we're checking redirect
			filter(state => !state.loading),
			take(1), // Only take the first definitive state
			map(state => !!state.user),
			tap(isAuthenticated => {
				if (!isAuthenticated) {
					console.log('🔒 AuthGuard: Access denied, redirecting to login');
					this.router.navigate(['/login']);
				}
			})
		);
	}
}
