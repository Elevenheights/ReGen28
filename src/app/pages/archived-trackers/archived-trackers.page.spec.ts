import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ArchivedTrackersPage } from './archived-trackers.page';

describe('ArchivedTrackersPage', () => {
  let component: ArchivedTrackersPage;
  let fixture: ComponentFixture<ArchivedTrackersPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ArchivedTrackersPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
