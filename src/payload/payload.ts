import { getPayload } from "payload";
import configPromise from "@/payload.config";

export const payloadClient = () => {
  return getPayload({ config: configPromise });
};
