export type Role = "student" | "teacher" | "parent" | "admin";
export interface Profile {
  id: string; full_name: string; email: string; mobile?: string | null;
  role: Role; class_label?: string | null; board?: string | null;
  subject?: string | null; child_name?: string | null; child_student_id?: string | null;
  institute_name?: string | null; city?: string | null; created_at?: string;
}
export const FEATURES = [
  "Overview","Batches","Lectures","Study Materials","Assignments","Exams & Tests",
  "Live Classes","Attendance","Fees & Receipts","Doubts & Chat","Notifications",
  "Reports","Users","Permissions","Profile",
] as const;
export const FEATURE_KEYS = [
  "overview","batches","lectures","materials","assignments","tests","live_classes",
  "attendance","fees","doubts","notifications","reports","users","permissions","profile",
] as const;
