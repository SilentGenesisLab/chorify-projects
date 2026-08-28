import { AsyncLocalStorage } from "node:async_hooks";

export type ApiRequestActor = {
  id: string;
  userId: string;
  name: string;
  prefix: string;
  requestMethod: string;
  requestPath: string;
};

const storage = new AsyncLocalStorage<ApiRequestActor>();

export const currentApiActor = () => storage.getStore();

export function runAsApiActor<T>(actor: ApiRequestActor, work: () => T): T {
  return storage.run(actor, work);
}
