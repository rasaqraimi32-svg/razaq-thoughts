"use client";
import { useFormStatus } from "react-dom";

export default function LogoutButton() {
  const { pending } = useFormStatus();
  return <button className="button button-outline" type="submit" disabled={pending}>{pending ? "Signing out…" : "Logout"}</button>;
}
