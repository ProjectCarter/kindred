import type { Metadata } from "next";
import LegalPage, { LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Contact",
  description: "How to reach the Kindred team.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <LegalPage title="Contact" updated="July 25, 2026">
      <p className="text-base leading-relaxed">
        We&rsquo;d love to hear from you. Use the address that best fits your
        question and we&rsquo;ll get back to you.
      </p>

      <LegalSection heading="General questions">
        <p>
          For anything about Kindred, email{" "}
          <a
            href="mailto:hello@discoverkindred.com"
            className="font-medium text-lilac-600 hover:text-lilac-500 dark:text-lilac-300"
          >
            hello@discoverkindred.com
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection heading="Product support">
        <p>
          Need help with the app? Email{" "}
          <a
            href="mailto:support@discoverkindred.com"
            className="font-medium text-lilac-600 hover:text-lilac-500 dark:text-lilac-300"
          >
            support@discoverkindred.com
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection heading="Privacy & data requests">
        <p>
          For privacy questions or to access, correct, or delete your data, email{" "}
          <a
            href="mailto:privacy@discoverkindred.com"
            className="font-medium text-lilac-600 hover:text-lilac-500 dark:text-lilac-300"
          >
            privacy@discoverkindred.com
          </a>
          , or see our{" "}
          <a
            href="/data-requests"
            className="font-medium text-lilac-600 hover:text-lilac-500 dark:text-lilac-300"
          >
            Data Requests
          </a>{" "}
          page.
        </p>
      </LegalSection>

      <LegalSection heading="For legal review">
        <p className="text-sm text-ink-muted dark:text-[#8E8AA0]">
          <strong>Note — requires legal review before launch:</strong> Kindred&rsquo;s
          legal entity name and mailing address are to be confirmed with counsel
          before they are published here.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
