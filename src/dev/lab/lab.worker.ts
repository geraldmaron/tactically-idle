// The lab's one worker script, run as a pool (jobs/pool.ts, spec 9.5). It registers every tuning
// table first, so a request's patch reaches all of them, then serves JobRequests one at a time
// through the same host the tests run (jobs/runners.ts createJobHost) and answers with progress and
// one result or error per request.
// No dynamic import() anywhere in this graph: workers build as iife (spec 9.1, rule 6).
import '../../sim/tuning-tables';
import type { JobCancel, JobEvent, JobRequest } from './jobs/protocol';
import { createJobHost } from './jobs/runners';

const scope = self as unknown as { onmessage: ((event: MessageEvent<JobRequest | JobCancel>) => void) | null; postMessage: (message: JobEvent) => void };

const host = createJobHost(event => scope.postMessage(event));
scope.onmessage = event => host.receive(event.data);
