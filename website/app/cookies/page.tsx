import type { Metadata } from "next";
import LegalPage, { LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description:
    "How Kindred uses cookies and similar technologies, and how you can manage them.",
  alternates: { canonical: "/cookies" },
};

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie Policy" updated="July 25, 2026">
      <p className="text-base leading-relaxed">
        This is a plain-language placeholder that explains how Kindred uses
        cookies and similar technologies. Replace it with your finalized cookie
        policy before launch.
      </p>

      <LegalSection heading="What cookies are">
        <p>
          Cookies are small files stored on your device that help websites and
          apps remember your preferences and understand how a product is used.
          Similar technologies include local storage and device identifiers.
        </p>
      </LegalSection>

      <LegalSection heading="How we use them">
        <p>
          Kindred uses these technologies to keep the experience working (for
          example, remembering your theme and basic preferences) and to
          understand how the product is used so we can improve it. We do not use
          cookies to sell your personal information.
        </p>
      </LegalSection>

      <LegalSection heading="Managing cookies">
        <p>
          You can control or clear cookies through your browser or device
          settings. Disabling some cookies may affect how parts of the
          experience work.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          Questions about cookies? Email{" "}
          <a
            href="mailto:privacy@discoverkindred.com"
            className="font-medium text-lilac-600 hover:text-lilac-500 dark:text-lilac-300"
          >
            privacy@discoverkindred.com
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection heading="For legal review">
        <p className="text-sm text-ink-muted dark:text-[#8E8AA0]">
          <strong>Note — requires legal review before launch:</strong> the
          specific categories of cookies used, retention periods, third-party
          processors, and any region-specific consent requirements are to be
          confirmed with counsel.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
