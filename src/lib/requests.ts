import type { CustomRequestStatus } from "./domain";
import type { StatusTone } from "./orders/status";

export const CUSTOM_REQUEST_STATUS_LABEL: Record<CustomRequestStatus, string> = {
  NEW: "Received",
  IN_REVIEW: "In review",
  QUOTED: "Quote sent",
  ACCEPTED: "Accepted",
  IN_PROGRESS: "Being made",
  COMPLETED: "Completed",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
};

export const CUSTOM_REQUEST_STATUS_TONE: Record<CustomRequestStatus, StatusTone> = {
  NEW: "warning",
  IN_REVIEW: "info",
  QUOTED: "info",
  ACCEPTED: "success",
  IN_PROGRESS: "info",
  COMPLETED: "success",
  DECLINED: "neutral",
  CANCELLED: "neutral",
};
