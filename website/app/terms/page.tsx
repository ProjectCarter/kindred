import type { Metadata } from "next";
import LegalPage, { LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern your use of Kindred.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="July 23, 2026">
      <p className="text-base leading-relaxed">
        These placeholder terms outline the basics of using Kindred. Replace this
        page with your finalized terms before launch.
      </p>

      <LegalSection heading="Using Kindred">
        <p>
          Kindred provides a curated daily edition of local content for personal,
          non-commercial use. Please use the app respectfully and in accordance
          with applicable laws.
        </p>
      </LegalSection>

      <LegalSection heading="Content and accuracy">
        <p>
          We work hard to verify events, places, and information, but details can
          change. Always confirm important details (dates, hours, tickets)
          directly with the venue or organizer.
        </p>
      </LegalSection>

      <LegalSection heading="Accounts and access">
        <p>
          You are responsible for keeping your account secure. We may update or
          discontinue features to improve the experience.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          Questions about these terms? Email{" "}
          <a
            href="mailto:hello@discoverkindred.com"
            className="font-medium text-lilac-600 hover:text-lilac-500 dark:text-lilac-300"
          >
            hello@discoverkindred.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
