import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ModalController } from '@ionic/angular/standalone';
import { of } from 'rxjs';
import { InsightsPage } from './insights.page';
import { AuthService } from '../../../services/auth.service';
import { UserService } from '../../../services/user.service';
import { TrackerService } from '../../../services/tracker.service';
import { GoalService } from '../../../services/goal.service';
import { JournalService } from '../../../services/journal.service';
import { ActivityService } from '../../../services/activity.service';
import { ErrorHandlingService } from '../../../services/error-handling.service';
import { LoggingService } from '../../../services/logging.service';
import { TrackerSuggestionsService } from '../../../services/tracker-suggestions.service';
import { StatisticsService } from '../../../services/statistics.service';
import { FeedService } from '../../../services/feed.service';
import { LoggingModalService } from '../../../services/logging-modal.service';
import { ToastService } from '../../../services/toast.service';
import { BreatheModalComponent } from '../../../components/breathe-modal/breathe-modal.component';

describe('Full dashboard feature parity', () => {
  let fixture:any, page:InsightsPage, journal:any, modal:any, logger:any;
  const tracker = {id:'walk',name:'Morning walk',isActive:true,streak:3,consistencyScore:75,progress:40,category:'body'};
  beforeEach(async () => {
    journal = {getJournalDailyStats:() => of([]),getJournalEntriesByDateRange:jasmine.createSpy().and.returnValue(of([{date:new Date(),mood:8}] ))};
    modal = {create:jasmine.createSpy().and.resolveTo({present:async()=>{},onDidDismiss:async()=>({})})};
    logger = {openLogModal:jasmine.createSpy()};
    await TestBed.configureTestingModule({
      imports:[InsightsPage],providers:[provideRouter([]),
        {provide:AuthService,useValue:{}},
        {provide:UserService,useValue:{getCurrentUserProfile:() => of({displayName:'Alex',currentDay:12,stats:{totalTrackerEntries:14,totalJournalEntries:4}})}},
        {provide:TrackerService,useValue:{getTrackerDashboardData:() => of({activeTrackers:[tracker],todaysEntries:[],weeklyStats:{totalEntries:3}})}},
        {provide:GoalService,useValue:{getActiveGoals:() => of([])}},
        {provide:JournalService,useValue:journal},
        {provide:ActivityService,useValue:{getRecentActivities:() => of([])}},
        {provide:ErrorHandlingService,useValue:{}},
        {provide:LoggingService,useValue:{info:()=>{},debug:()=>{},warn:()=>{},error:()=>{}}},
        {provide:TrackerSuggestionsService,useValue:{suggestionsState$:of({}),loadSuggestionsForTrackers:async()=>{}}},
        {provide:StatisticsService,useValue:{getTodaysStats:() => of({overallStreak:3}),getJournalDailyStats:() => of([]),getWeeklyMoodTrend:() => of([]),getPerformanceInsights:() => of({consistencyScore:75,bestPerformanceHour:8,energyProductivityIndex:0}),getRecentStats:() => of([])}},
        {provide:FeedService,useValue:{getTodaysActionsAndInsights:() => of({actions:[],insights:[]})}},
        {provide:LoggingModalService,useValue:logger},
        {provide:ToastService,useValue:{showSuccess:()=>{},showInfo:()=>{},showError:()=>{}}},
        {provide:ModalController,useValue:modal}
      ]
    }).compileComponents();
    fixture=TestBed.createComponent(InsightsPage); page=fixture.componentInstance; fixture.detectChanges();
  });
  afterEach(() => fixture?.destroy());
  it('renders every original dashboard section and all four tools', () => {
    const text = fixture.nativeElement.textContent;
    for(const section of ['Today’s guidance','Your engagement','Mind check-in','Top performing trackers','Progress overview','Your goals','Recent activity','Your tools','A little inspiration']) expect(text).toContain(section);
    expect(fixture.nativeElement.querySelectorAll('.dashboard-tools button').length).toBe(4);
    expect(fixture.nativeElement.querySelectorAll('.category-performance button').length).toBe(4);
  });
  it('switches to actual month data and keeps high moods inside the chart', () => {
    page.setMoodChartTimeframe('month'); fixture.detectChanges();
    const [start,end] = journal.getJournalEntriesByDateRange.calls.mostRecent().args;
    expect((end.getTime()-start.getTime())/86400000).toBeGreaterThan(29);
    expect(page.moodChart.length).toBe(30);
    expect(page.getMoodPoints().every(point => point.cy >=10 && point.cy <=100)).toBeTrue();
  });
  it('connects the original breathing, logging and navigation actions', async () => {
    await page.openBreathe(); await page.openQuickLogModal();
    expect(modal.create).toHaveBeenCalledWith(jasmine.objectContaining({component:BreatheModalComponent}));
    expect(logger.openLogModal).toHaveBeenCalledWith(tracker,jasmine.any(Function));
    const navigate = spyOn(TestBed.inject(Router),'navigate').and.resolveTo(true);
    page.viewAllGoals(); page.viewAllActivities(); page.viewCategories();
    expect(navigate).toHaveBeenCalledWith(['/goals']);
    expect(navigate).toHaveBeenCalledWith(['/activities']);
    expect(navigate).toHaveBeenCalledWith(['/tabs/tracker']);
  });
});
