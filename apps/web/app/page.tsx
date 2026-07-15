import Link from "next/link";
import FixtureDemo from "@/components/FixtureDemo";
import OpenPrForm from "@/components/OpenPrForm";
import { oauthConfigured } from "@/lib/env";
import { readSession } from "@/lib/session";

export default async function HomePage() {
	const session = await readSession().catch(() => null);
	const canSignIn = oauthConfigured();

	return (
		<div className="home">
			<header className="home__header">
				<div className="home__intro">
					<h1 className="home__title">Goreview</h1>
					<p className="home__tagline">
						Tree comparison and real diffs for GitHub pull requests. Below is
						the fixture demo; open a live PR to review the real thing.
					</p>
				</div>
				<div className="home__actions">
					<OpenPrForm />
					{session ? (
						<form action="/api/auth/logout" method="post" className="home__auth">
							<span className="home__user">@{session.login}</span>
							<button type="submit" className="home__signout">
								Sign out
							</button>
						</form>
					) : canSignIn ? (
						<Link href="/api/auth/login" className="home__signin">
							Sign in with GitHub
						</Link>
					) : (
						<p className="home__hint">
							OAuth not configured — public repos work via the App
							installation, or run locally with a token.
						</p>
					)}
				</div>
			</header>

			<FixtureDemo />
		</div>
	);
}
