import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonContent,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonTextarea,
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonInput,
  IonNote,
  IonButtons
} from '@ionic/angular/standalone';
import { ExploreContainerComponent } from '../../../explore-container/explore-container.component';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonHeader, 
    IonToolbar, 
    IonTitle, 
    IonContent,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonTextarea,
    IonButton,
    IonIcon,
    IonItem,
    IonLabel,
    IonInput,
    IonNote,
    IonButtons,
    ExploreContainerComponent
  ]
})
export class Tab2Page {

  constructor() {}

}
