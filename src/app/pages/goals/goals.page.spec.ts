import { GoalsPage } from './goals.page';

describe('GoalsPage inline creation', () => {
  let page: GoalsPage;
  let service: any;
  let toast: any;
  beforeEach(() => {
    service = { createGoal: jasmine.createSpy().and.resolveTo('new-goal') };
    toast = { showSuccess: jasmine.createSpy(), showError: jasmine.createSpy() };
    page = new GoalsPage(service, {} as any, toast, {} as any);
  });

  it('saves a trimmed title and the chosen focus area', async () => {
    await page.onAddGoal();
    page.goalTitle = '  Get outdoors  ';
    page.goalCategory = 'body';
    await page.saveGoal();
    expect(service.createGoal).toHaveBeenCalledWith({ title: 'Get outdoors', category: 'body' });
    expect(page.showGoalForm).toBeFalse();
  });

  it('keeps the draft available after a failed save', async () => {
    service.createGoal.and.rejectWith(new Error('offline'));
    await page.onAddGoal();
    page.goalTitle = 'A quiet morning';
    await page.saveGoal();
    expect(page.goalTitle).toBe('A quiet morning');
    expect(page.showGoalForm).toBeTrue();
    expect(page.savingGoal).toBeFalse();
    expect(toast.showError).toHaveBeenCalled();
  });

  it('does not create blank goals or submit twice while saving', async () => {
    page.goalTitle = '   ';
    await page.saveGoal();
    expect(service.createGoal).not.toHaveBeenCalled();
    let finish!: (id: string) => void;
    service.createGoal.and.returnValue(new Promise<string>(resolve => finish = resolve));
    page.goalTitle = 'Read';
    const save = page.saveGoal();
    await page.saveGoal();
    expect(service.createGoal).toHaveBeenCalledTimes(1);
    finish('new-goal');
    await save;
  });
});
