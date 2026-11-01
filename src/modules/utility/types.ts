import type { TaskScheduler } from '../../scheduler/task-scheduler.js';

export interface UtilityModuleOptions {
  readonly scheduler?: TaskScheduler;
}
