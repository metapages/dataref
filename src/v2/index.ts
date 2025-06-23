import { isDataRef as isDataRefV1 } from "../v1";

export const isDataRef = (value: any): boolean => {
  return (
    !!(
      value &&
      typeof value === "string" &&
      (value as string).startsWith("data:")
    ) || isDataRefV1(value)
  );
};
