import { redirect } from "next/navigation";

/** Timetable lives under Training Content (left Timetable tab); keep old URL working. */
export default function AdminWorkshopsPage() {
  redirect("/admin/courses");
}
