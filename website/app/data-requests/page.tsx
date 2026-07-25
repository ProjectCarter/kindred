import type { Metadata } from "next";
import LegalPage, { LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Data Requests",
  description:
    "Request access to, correction of, or deletion of your personal information from Kindred.",
  alternates: { canonical: "/data-requests" },
};

export default function DataRequestsPage() {
  return (
    <LegalPage title="Data Requests" updated="July 25, 2026">
      <p className="text-base leading-relaxed">
        This page explains how to ask Kindred about the personal information we
        hold and how to request access, correction, or deletion. It is a
        plain-language placeholder — replace it with your finalized process
        before launch.
      </p>

      <LegalSection heading="Your rights">
        <p>
          Depending on where you live, you may have the right to access a copy of
          your personal information, correct inaccurate information, request
          deletion, or object to certain processing. We honor valid requests in
          line with applicable law.
        </p>
      </LegalSection>

      <LegalSection heading="How to make a request">
        <p>
          Email{" "}
          <a
            href="mailto:privacy@discoverkindred.com"
            className="font-medium text-lilac-600 hover:text-lilac-500 dark:text-lilac-300"
          >
            privacy@discoverkindred.com
          </a>{" "}
          and tell us what you would like to do (access, correct, or delete). To
          protect your privacy, we may need to verify your identity before acting
          on a request.
        </p>
      </LegalSection>

      <LegalSection heading="What happens next">
        <p>
          We will acknowledge your request and respond within the timeframe
          required by applicable law. If we cannot fulfill a request, we will
          explain why.
        </p>
      </LegalSection>

      <LegalSection heading="Governing law">
        <p>
          These requests are handled in accordance with the data-protection laws
          that apply to you. Nothing here waives any right you may have under
          those laws.
        </p>
      </LegalSection>

      <LegalSection heading="For legal review">
        <p className="text-sm text-ink-muted dark:text-[#8E8AA0]">
          <strong>Note — requires legal review before launch:</strong> Kindred&rsquo;s
          legal entity name, mailing address, governing state/jurisdiction,
          statutory response deadlines, and any region-specific rights (for
          example, under GDPR or CCPA/CPRA) are to be confirmed with counsel.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
