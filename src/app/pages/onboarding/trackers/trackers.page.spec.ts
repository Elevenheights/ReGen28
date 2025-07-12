import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TrackersPage } from './trackers.page';

describe('TrackersPage', () => {
  let component: TrackersPage;
  let fixture: ComponentFixture<TrackersPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(TrackersPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
