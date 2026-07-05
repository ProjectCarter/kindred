import { signOut } from "@/app/actions/auth";

export default function SignOutButton() {
  return (
    <form action={signOut}>
      <button type="submit" className="btn-ghost">
        Sign out
      </button>
    </form>
  );
}
