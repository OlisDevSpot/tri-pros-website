export interface Job {
  /**
   * The job key, used to identify the job.
   */
  key: string

  /**
   * The job handler, called when the job is triggered.
   */
  handler: JobHandler
}

/**
 * A handler is any function that takes a single argument.
 */
export type JobHandler<T = any> = (payload: T) => Promise<void>

/**
 * A map of job keys to their handlers.
 * Will be used to retrieve handlers by key.
 */
export type JobMap = Map<string, JobHandler>
