import { Component, EnvironmentInjector, inject } from '@angular/core';
import { IonTabs, IonTabBar, IonTabButton, IonLabel, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { homeOutline, layersOutline, statsChartOutline, bookOutline, personOutline } from 'ionicons/icons';

@Component({
	selector: 'app-tabs',
	templateUrl: 'tabs.page.html',
	styleUrls: ['tabs.page.scss'],
	imports: [IonTabs, IonTabBar, IonTabButton, IonLabel, IonIcon],
})
export class TabsPage {
	public environmentInjector = inject(EnvironmentInjector);

	constructor() {
		addIcons({ homeOutline, layersOutline, statsChartOutline, bookOutline, personOutline });
	}
}
