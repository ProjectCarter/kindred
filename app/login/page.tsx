import LoginForm from "./LoginForm";

type LoginPageProps = {
  searchParams: { error?: string };
};

export default function LoginPage({ searchParams }: LoginPageProps) {
  return <LoginForm authError={searchParams.error} />;
}
